# Research: Mailboxes

**Feature**: `specs/003-mailboxes` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

This document records only the decisions this feature adds. The stack, structure, contract pinning,
client generation, mock API, test layers, i18n, theming, session handling, routing and the shared
primitives are UI 001's decisions (`specs/001-sign-in-app-shell/research.md`, cited as
"UI 001 R<n>") and are not repeated. Precedence, as for every plan: the constitution, then the
pinned mailcow-rest-v2 contract, then `docs/conventions.md`, then UI 001's decisions, then best
practice. Each entry has a **Decision**, its **Rationale** and the **Alternatives considered**.

Facts about the contract were checked against the planning baseline (R1): the bundle was built with
`@redocly/cli@2.64.1` and the types were generated with `openapi-typescript@7.13.0` and UI 001's
flags. Every enumeration this plan names exists as a generated `…Values` array.

---

## 1. Contract and translations

### R1. Contract pin for this feature (constitution I, UI 001 R6)

- **Decision**:
  - The **planning baseline** is mailcow-rest-v2 commit
    `32079252d55797d3da4e58ae661e9fb91c51c6f9` (2026-10-18, "Register KnownProblemType in contract
    components"). Its bundle has sha256
    `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6` and 376 operations. It holds
    the complete contracts of API 001, 002 and 003.
  - **The implementation pin** is set by T001 with `scripts/contract/bump.sh <ref>`:
    1. the release tag of API feature 003, if mailcow-rest-v2 publishes one;
    2. otherwise the mailcow-rest-v2 commit that merges the API 003 implementation, so that the
       smoke suite (which checks out the pinned commit, UI 001 R25) runs the implementation that
       matches the contract;
    3. while the implementation is not merged yet, the baseline itself, so that the feature can be
       built against the mock. The pin then moves forward to the merge commit before the smoke
       tasks (T131);
    4. never "the latest commit" without the review below.

    Contract pins only move forward (`docs/conventions.md`, "Shared building blocks and canonical
    names"). If the pin left by UI 002 or a later feature is newer than the baseline and contains
    every operation of [contracts/README.md](./contracts/README.md), it is kept and never moved
    back.
  - **Review step**: whatever the pin, UI 003 checks its own operations against its baseline:
    `git diff <baseline>..<pinned commit> -- api/` in mailcow-rest-v2 is read for the 21 operations
    and the schemas this feature uses. A changed member is a plan change, not
    a silent fix.
  - A pin that contains API 003 necessarily contains the contracts of later API features: API 003's
    contract was merged after the plans of API 005, 007 and 009 and was revised after them. The UI
    still uses only the operations listed in the contracts README (constitution I). Every request
    the mock receives is matched to one of these operations by the validator (UI 001 R22).
  - The baseline registers `KnownProblemType` under `components.schemas`, so the generated client
    now exports `knownProblemTypeValues`. This closes UI 001's API gap 5.
- **Rationale**: UI 001 R6 makes the commit the identifier and every bump a deliberate change.
  Pinning the commit that merges the implementation gives the smoke suite a server that matches the
  contract.
- **Alternatives considered**: Pinning a commit with only API 001–003: impossible, because the
  contracts of later features were merged earlier in the history. Waiting for one release tag per
  API feature: mailcow-rest-v2 publishes none yet, so this would block planning.

### R2. Translation completeness with a full-tree pin (constitution IV, UI 001 R27)

- **Decision**: UI 003 uses the coverage registry that UI 002 introduces (UI 002 research D2), as
  `docs/conventions.md` ("Shared building blocks and canonical names") requires. UI 001 defines no
  scoping mechanism of its own.
  - UI 001's `i18n:check` rule 3 requires a key for every value of every checked contract
    enumeration. At the baseline pin, the growing shared enumerations hold the values of all API
    features: 161 `AuditEventType`, 73 `AuditTarget.type`, 49 `AuditFailureReason`, 46
    `ValidationRuleCode` and 86 problem types.
  - UI 002's committed manifest **`src/i18n/coverage.json`** lists, per growing shared enumeration
    (`AuditEventType`, `AuditTarget.type`, `AuditFailureReason`, `AuthMethod`, `ValidationRuleCode`
    and `problemTypes`), the values the app translates.
    - A listed value without a key in any locale, or one that the pinned contract no longer has, is
      an error.
    - An unlisted contract value is a warning. At runtime it falls back to the generic label:
      `auditLog.unknown`, `problem.status.<status>` and then `problem.generic`, or
      `validation.invalid`.
  - **UI 003 appends** the values of data-model §9 to `src/i18n/coverage.json` (T003).
  - **Closed enumerations** that UI 003 introduces into the UI, such as `MailboxStatus`,
    `MailboxAuthSource` and `MailboxRenameStep.step`, stay fully required, as UI 002 decided for
    its own. They are added to `ENUM_NAMESPACES` in `scripts/i18n/lib.mjs`, under
    `enums.<name>.<value>` as UI 001's implementation names them (data-model §9).
  - T004 adds the labels.
- **Rationale**: The conventions name UI 002's registry as the canonical mechanism. It keeps
  "missing keys fail CI" for everything the app renders by design, and it avoids translating about
  300 labels of unbuilt features. No user-facing text is ever untranslated: unknown values show
  translated generic labels.
- **Alternatives considered**: A separate UI 003 registry (`enum-scope.json`, the first draft of
  this plan): rejected by the conventions' canonical-names rule. Translating every value now:
  rejected, because it is against the conventions.

### R3. Legacy translation reuse (constitution IV, FR-072)

> **Superseded in part by constitution IV 1.3.0 (owner rule, 2026-10-18;
> `docs/conventions.md`, "Translations and forms").** The keys below are used directly by their
> legacy name, verbatim, from the installation's `/lang/` files at runtime, with no
> `legacy-map.json` alias and no copy in `src/i18n/messages/`. The "Not mapped" exclusions are
> lifted, nothing is supplied by hand for a missing Czech or Slovak value (it falls back to
> `en-gb`), and the list is completed by the legacy form map (T008a), which covers every legacy
> key the screens of plan.md "Translations and forms" use, not only these.

- **Decision**: Use these legacy keys verbatim. The upstream baseline of the bundled `en-gb`
  snapshot is `2026-09a`.
  - `mailbox.*`: `mailboxes`, `add_mailbox`, `mailbox_templates`, `add_template`, `username`,
    `domain`, `active`, `inactive`, `disable_login`, `in_use`, `msg_num`, `last_mail_login`,
    `last_pw_change`, `created_on`, `last_modified`, `tls_enforce_in`, `tls_enforce_out`,
    `quarantine_notification`, `quarantine_category`, `allowed_protocols`, `toggle_all`, `edit`,
    `remove`, `template`, `templates`, `force_pw_update`.
  - `add.*`: `mailbox_username`, `full_name`, `password`, `password_repeat`, `generate`, `tags`,
    `quota_mb` (verbatim, with its "(MiB)"; the unit question is plan deviation 3),
    `select_domain`.
  - `edit.*`: `mailbox`, `full_name`, `mailbox_rename`, `mailbox_rename_warning`, `mailbox_rename_agree`,
    `mailbox_rename_title`, `custom_attributes`, `password_recovery_email`, `sogo_access`,
    `sogo_access_info`, `allowed_protocols`, `ratelimit`.
  - `acl.*`: `prohibited`, `protocol_access`, `sogo_access`, `ratelimit`, `unlimited_quota`, and
    the 14 user-permission labels `spam_alias`, `tls_policy`, `spam_score`, `spam_policy`,
    `delimiter_action`, `syncjobs`, `eas_reset`, `sogo_profile_reset`, `pushover`, `quarantine`,
    `quarantine_attachments`, `quarantine_notification`, `quarantine_category`, `app_passwds`.
  - `tfa.force_tfa`, `user.tag_handling`, `user.tag_in_none`, `user.tag_in_subfolder`,
    `user.tag_in_subject`, `user.attribute`, `user.no_record`.
  - `admin.password_policy_length`, `admin.password_policy_chars`,
    `admin.password_policy_numbers`, `admin.password_policy_special_chars`,
    `admin.password_policy_lowerupper`.
  - `success.mailbox_added`, `success.mailbox_modified`, `success.mailbox_removed`,
    `success.mailbox_renamed`, `success.template_added`, `success.template_modified`.
  - `warning.quota_exceeded_scope`.

  **Formerly "not mapped", now used verbatim** (constitution IV 1.3.0):
  - `acl.pw_reset` ("Allow to reset mailcow user password" upstream; the installation's own text,
    such as the fork's "FeldHost™ Mailhosting" wording, is what appears). No `{productName}` key.
  - `edit.force_pw_update_info`, whose `%s` is filled with the product name from the branding
    configuration, as legacy fills it with `ui_texts.main_name`.
  - `success.template_removed` ("Template ID %s has been deleted"), with the template's ID as legacy
    passes it.
  - `edit.mailbox_rename_alias` ("Create alias automatically"), with the legacy checkbox (plan
    deviation 5).
  - The HTML values `user.tag_help_explain` and `user.tls_policy_warning`, rendered through
    `SanitizedHtml.vue`.
  - The built-in authentication source option has no legacy key (the template hard-codes the
    product name), so it takes the product name from the branding configuration.

  **Missing in the upstream Slovak file** (`edit.mailbox_rename`, `edit.mailbox_rename_warning`,
  `edit.mailbox_rename_agree`, `edit.mailbox_rename_title`, `edit.custom_attributes`,
  `edit.password_recovery_email`, `success.mailbox_renamed`, `user.attribute`; `tfa.force_tfa` also
  in `cs-cz`, verified at `2026-09a`): they fall back to `en-gb`, as in the classic interface. The
  fork's `cs-cz` and `sk-sk` files have all of them. No value is written by hand.
- **Rationale**: Constitution IV 1.3.0: mailcow's translations were written by people and are used
  one to one, and the installation's own files decide the wording, including the product name.
- **Alternatives considered**: New keys with `{productName}` for `acl.pw_reset` and
  `edit.force_pw_update_info`, and hand-written Slovak values: rejected by the owner rule of
  2026-10-18, because they change or replace human translations.

---

## 2. Reuse of earlier features

### R4. Building blocks from UI 001 and UI 002 (constitution VIII)

- **Decision**: UI 003 adds no runtime dependency. It reuses these blocks.
  - **From UI 001** (planned, implemented before UI 003):
    - `useListState`, `ListState.vue`, `PaginationBar.vue`;
    - `useConfirm` and `ConfirmDialog.vue`, `useVersionedSave`;
    - `useProblemForm`, `FormField.vue`, `ErrorSummary.vue`, `ProblemMessage.vue`;
    - `useAnnouncer`, `DateTime.vue`, `RelativeTime.vue`, `PageHeader.vue`, `useMediaQuery`;
    - `src/shared/platform/clipboard.ts` and `storage.ts`;
    - `src/i18n/format.ts` and `problems.ts`;
    - `NoAccessState.vue` and the navigation catalogue;
    - the audit log screen;
    - the TailAdmin primitives (combobox, dialog, dropdown menu, switch, radio group, checkbox,
      collapsible, table, badge, alert).
  - **From UI 002**, with the canonical names of `docs/conventions.md` ("Shared building blocks
    and canonical names") and UI 002's research. UI 003 imports them and never creates a renamed
    copy:
    - `src/shared/composables/useBulkSelection.ts`, `src/shared/components/BulkActionBar.vue` and
      `src/shared/components/BulkResultSummary.vue` (UI 002 D22);
    - `src/shared/components/ConfirmDialog.vue` with `requireTyped` and rich content;
    - `src/shared/components/EditableSection.vue` with the `changedSince` extension of
      `useVersionedSave` (UI 002 D11);
    - `src/shared/components/HistoryLink.vue`, with the `targetType` and `targetId` filters on the
      audit log screen (UI 002 D26);
    - `src/shared/composables/useLeaveGuard.ts` (`useLeaveGuard(shouldGuard, messageKey)`, UI 002
      D21);
    - `formatBytes(bytes, { exact })` in `src/i18n/format.ts` (UI 002 D12);
    - `src/app/states/NotFoundPage.vue` with its optional back link (UI 002, FR-004);
    - the coverage registry `src/i18n/coverage.json` (R2).
  - **Promoted by UI 003 as their second use** (UI 002 D3 keeps them in its feature until then):

    | Block | From (UI 002) | To | Task |
    |---|---|---|---|
    | Quota field (amount plus MiB, GiB or TiB, largest exact unit) | `src/features/domains/components/fields/QuotaField.vue` and the byte and unit conversion of `src/features/domains/quota.ts` | `src/shared/components/QuotaField.vue`, `src/shared/utils/quota-units.ts` | T012, T016 |
    | Usage meter (text, bar, level as text) | `src/features/domains/components/list/UsageMeter.vue` and `usage.ts` | `src/shared/components/UsageMeter.vue`, with threshold props; UI 002's levels stay the default | T013, T017 |
    | Tag set editor (case-insensitive set, limit, suggestions, filter mode) | `src/features/domains/components/fields/TagSetInput.vue` and `tag-set.ts` | `src/shared/components/TagSetInput.vue`, `src/shared/utils/tag-set.ts` | T013, T017 |
    | Removable filter chips | `src/features/audit-log/components/ActiveFilterChips.vue` (UI 001 R20 promotion path) | `src/shared/components/ActiveFilterChips.vue` | T014, T018 |

    Each promotion moves the files without changing their behaviour, updates UI 002's (or the audit
    log's) imports and keeps their tests green. If UI 002 already promoted a block, the task only
    adds UI 003's cases.
  - **Added by UI 003**: `formatDuration(minutes)` in `src/i18n/format.ts`, for the garbage-area
    retention (T012, T016).
  - **Kept in this feature, with a promotion path**:
    - `DomainPicker.vue` (searchable, infinite, single or multiple). UI 004 (aliases) is its second
      use, so it is exported from `@/features/mailboxes`, and UI 004 promotes it.
    - `PasswordField.vue` with the generator. UI 005 (own password) and UI 007 (account passwords)
      are its later uses.
- **Rationale**: Constitution VIII: a shared block appears after the second concrete use. UI 001
  R20 fixed the reserved locations. Naming the exact paths for the others makes the tasks concrete,
  whatever UI 002 decides.
- **Alternatives considered**: Building private copies inside the feature: rejected, because it
  duplicates UI 002's code. Waiting for UI 002's plan: rejected, because the plans run in parallel
  and the tasks handle both outcomes.

---

## 3. Screens and navigation

### R5. Routes, the section-based detail screen and History (FR-002, FR-015 to FR-017, FR-064)

- **Decision**:
  - Routes are lazy (UI 001 R19). The full map is in data-model §5. In outline:
    - `/mailboxes`: the list;
    - `/mailboxes/new`: the create screen;
    - `/mailboxes/:address`: the detail layout, with one child route per section:
      - `''`: the overview;
      - `general`, `sign-in`, `protocols`, `permissions`, `tags`, `attributes` and `rename`;
      - `delete`: opens the deletion dialog over the overview;
    - `/mailbox-templates`, `/mailbox-templates/new` and `/mailbox-templates/:templateId`.
  - **The detail layout** (`MailboxDetailPage.vue`) loads the mailbox once with `getMailbox` and
    gives it to its children.
    - On phones (below `lg`), the overview lists the sections with a one-line summary each
      (FR-016). A section opens as its own page, with a back link to the overview.
    - From `lg` up, `MailboxSectionNav.vue` stays visible in a side column next to the routed
      content.
    - A mailbox opened from the list renders at once from the list entry: the detail query's
      `initialData` is looked up in the cached list pages, with `initialDataUpdatedAt: 0`. The
      query then refetches (FR-017).
  - **Canonical address**: the route accepts any letter case and a Unicode domain, as the API does.
    When `data.address` differs from the route parameter, the route is replaced with the canonical
    address, so links and query keys stay stable.
  - **History** (FR-016, FR-064): the section navigation shows a "History" entry to administrators
    only. It is UI 002's `HistoryLink` to `/audit-log?targetType=mailbox&targetId=<address>`. Each
    template detail has the same with `targetType=mailboxTemplate&targetId=<id>`. The audit log
    screen provides newest-first paging, actors, outcomes with translated reasons and the expanded
    details. UI 003 adds the labels of its event types (R17).
  - **Delete as a section** (FR-016, FR-045): the `delete` child route renders the overview and
    opens `MailboxDeleteDialog.vue` on entry. Cancelling returns to the previous route when that
    route is within this mailbox, and otherwise replaces the route with the overview. The list's
    "Remove" action opens the same dialog without a route change.
- **Rationale**:
  - Child routes give every section its own link (FR-002) and use the router's guards for unsaved
    changes.
  - One query for the layout means no request per section.
  - Using the audit log screen for History follows `docs/conventions.md` ("History and audit") and
    UI 002's decision, and avoids a second audit list (VIII). The spec's "History section" is
    satisfied by an entry that opens the filtered audit log. The spec's wording is aligned.
- **Alternatives considered**:
  - Sections as in-page tabs: rejected, because they have no links and their focus behaviour is
    weaker.
  - An embedded audit list on the detail screen: rejected as a duplicate of UI 001's screen.
  - A delete page instead of a dialog: rejected by the conventions, which require a dialog.

### R6. Section forms, partial saves and outdated saves (FR-031 to FR-033, FR-044)

- **Decision**: Each section page wraps its fields in UI 002's `EditableSection`. Entering the
  section's route opens it for editing (the route sets UI 002's `edit` parameter), and
  `EditableSection` provides Save, Cancel, the sticky action bar below `md` and the inline status.
  `useMailboxSection(section)` in `src/features/mailboxes/composables/` supplies the mailbox
  logic. It is built on UI 001's `useVersionedSave` with UI 002's `changedSince` extension.
  - **State**:
    - `base`: the section's fields of the mailbox as read, with its `etag`;
    - `draft`: the user's values;
    - `touched`: the set of fields the user changed;
    - `marks`: the fields that changed on the server, each with its new value;
    - `saving`.
  - **Patch** (`src/features/mailboxes/patch.ts`, pure, unit-tested) follows the contract's JSON
    Merge Patch rules:
    - scalars are sent when the draft differs from `base`;
    - for `protocolAccess` and `userPermissions`, only the members that differ are sent, and the
      object is left out when none differs (the schemas have `minProperties: 1`);
    - `tags` sends the whole set when it differs as a case-insensitive set;
    - `customAttributes` sends added and changed names with their value, removed names with `null`,
      and a renamed attribute as a removal plus an addition;
    - `recoveryEmail` sends an empty value as `null`;
    - `password` is sent only when non-empty;
    - an empty patch disables Save.
  - **Save**: `PATCH /mailboxes/{address}` with `Content-Type: application/merge-patch+json` and
    `If-Match: base.etag`. A save that carries a password goes through UI 001's
    `useSecretRequest`, never through `useMutation` (R8); the other saves use a TanStack mutation. On `200`:
    1. the response is written to the detail cache and patched into the cached list pages;
    2. lists are invalidated;
    3. `base` and `draft` are reset from the response, and the password is cleared;
    4. `success.mailbox_modified` is announced.
  - **Outdated** (`412`):
    1. the mailbox is refetched;
    2. `marks` = the section fields whose stored value differs between the old `base` and the
       reloaded mailbox, each with its new value;
    3. untouched fields take the new values;
    4. touched fields keep the user's values;
    5. `base` becomes the reloaded mailbox with its new tag;
    6. a message says that someone else changed the mailbox.

    `EditableSection` offers UI 002's "Save again" and "Discard my changes". Nothing is retried,
    and there is no "overwrite anyway" (conventions).
  - **Deactivation**: saving the General section with the status changed to `inactive` or
    `loginDisabled` asks one explicit confirmation that names the effect (FR-035), as the
    conventions require for deactivating ("Confirmations").
  - **Other outcomes**:
    - `403 attribute-not-permitted`: each entry of `attributes` (a body path such as
      `protocolAccess.pop3`) gets a field error that names the missing permission from
      `requiredFlags`, and those fields turn read-only in the open form, as UI 002 D11 does. The
      identity and the mailbox are refetched, and the other input is kept (FR-043).
    - `422`: field errors through `useProblemForm`.
    - `404`: the not-found state (FR-004).
    - `503`: a message, keeping the draft.
  - **Leaving with unsaved changes** (FR-033): UI 002's `useLeaveGuard(dirty, messageKey)` asks
    before the route changes, and adds `beforeunload` while the draft is dirty.
- **Rationale**:
  - Sending only changed members avoids `attribute-not-permitted` for values a domain administrator
    did not touch.
  - It also keeps conflicts small (API FR-029, conventions).
  - Letting untouched fields follow the server never overwrites someone else's change.
- **Alternatives considered**: Sending the whole section: rejected. It turns unrelated server
  changes into overwrites once the tag matches again, and it trips flag checks. Merging
  automatically on `412`: forbidden by the conventions.

### R7. Mailbox list: address state, search, filters, sort and columns (FR-006 to FR-014)

- **Decision**:
  - **List state** (`src/features/mailboxes/list-state.ts`): a UI 001 `useListState` schema with
    these parameters:
    - `q`;
    - repeatable `domain`, `status`, `tag` and `source` (maps to `authSource`);
    - `sort`, with the 12 fields of `MailboxSort`;
    - `order`, `page` and `size` (25, 50, 100).

    Defaults are left out of the address. Changing the search, filters, sort or size resets `page`
    and calls `onReset`, which clears the bulk selection with an announcement (FR-054).
  - **Search**: nothing is written while the user types. 500 ms after the last keystroke the search
    is committed with `router.push` (FR-009), so each committed search is one history entry and
    Back restores the previous list (US1-AS3). This deviates from UI 001 R20's "typing uses
    replace" for this one parameter, because the spec's acceptance scenario requires it. Text is
    sent as typed, and the API matches it literally (edge case "special characters").
  - **Filters panel** (`MailboxFilters.vue`): a Reka `Dialog`, a sheet over the list on phones
    (FR-071), opened by "Filters". It contains:
    - **domain**: `DomainPicker` in multiple mode over `listDomains` with `q`;
    - **status**: three checkboxes;
    - **tag**: `TagSetInput` in filter mode, with suggestions from `listMailboxTags` (closes spec
      API gap 6);
    - **authentication source**: four checkboxes. The built-in source is labelled with the product
      name.

    On phones the panel also has the sort control. Active filters are shown as
    `ActiveFilterChips`, each removable, with "Clear all". A domain chip shows the readable name
    when the domain is in the query cache, and otherwise the ASCII value from the address.
  - **Sort**:
    - From `md` up, sortable headers expose `aria-sort`.
    - Below `md`, a native `<select>` offers the 12 fields × 2 orders (FR-010).
    - Mailboxes without a value sort last in both directions, which the API does.
  - **Layouts**:
    - Below `md`, `MailboxCard.vue` shows the address, display name, status badge, quota usage and
      message count. The whole card opens the mailbox, and a separate menu button holds the row
      actions.
    - From `md` up, `MailboxTable.vue` has the default columns of FR-008. The default columns are
      always shown; only the optional ones can be hidden or shown.
    - `ColumnChooser.vue` (a Reka `DropdownMenu` with checkbox items) shows or hides the optional
      columns: authentication source, last password change, the six protocols, TLS in and out,
      quarantine notification and category, created and modified.
  - **Remembered columns** (FR-008, FR-074): the optional columns shown are stored as a JSON array
    of column ids under `localStorage` `mailcowui-ng.mailboxes.columns`, through UI 001's storage
    wrapper. The key is added to its allowlist. Unknown ids are ignored, and a storage failure
    falls back to the defaults.
  - **Page size**: kept **in the address only**, as the conventions ("Lists") and UI 002 require.
    The spec's "page size remembered in the browser" contradicts both, so the conventions apply and
    the spec is aligned.
  - **Refresh**: a refresh action refetches the page (FR-014). Own changes invalidate the list
    (data-model §3).
  - **Last mail login column**: the newest of `lastLogins.imap`, `pop3` and `smtp`. When the
    capabilities say `lastLoginsReported: false`, the column shows "Not reported" instead of
    "No login recorded" (closes spec API gap 3).
- **Rationale**: Constitution II and the conventions' list rules. The address is the only list
  state, so links, Back and reloads restore the view. The column choice is a per-browser
  convenience that the spec allows (FR-074).
- **Alternatives considered**:
  - Storing the page size as well: rejected by the conventions.
  - Client-side filtering of a full page: rejected, because the API filters, and 10,000 mailboxes
    must not be downloaded.
  - Row virtualisation: unnecessary, because at most 100 rows are rendered.

---

## 4. Creating and editing

### R8. Password entry, generator, policy hints and memory hygiene (FR-028 to FR-030, FR-074)

- **Decision**:
  - **`PasswordField.vue`** (`src/features/mailboxes/components/password/`):
    - one input with `autocomplete="new-password"`, `autocapitalize="none"` and
      `spellcheck="false"`;
    - a labelled show/hide toggle; a typed password starts hidden;
    - "Generate", which fills the field and switches it to visible (FR-029);
    - "Copy", which uses `src/shared/platform/clipboard.ts` only on that action. When the
      clipboard is refused, the text is selected with a message.

    There is no confirmation field (clarification). The form has no field with
    `autocomplete="username"`, so the browser cannot pair the password with an account. A browser
    may still offer to save a generated password; the user can decline, and the app never stores
    it. This is accepted.
  - **Generator** (`password/generate.ts`, pure, injectable random source):
    - **Length**: `L = max(16, policy.minLength)`, at most 255 (the contract's `maxLength`).
    - **Alphabets**, without look-alike characters:
      - lower case `abcdefghijkmnopqrstuvwxyz` (no `l`);
      - upper case `ABCDEFGHJKLMNPQRSTUVWXYZ` (no `I`, `O`);
      - digits `23456789` (no `0`, `1`);
      - special characters `-_.+=!?`.

      The special set avoids quotes, backslashes, spaces, `{}` (the hash-scheme prefix syntax),
      `<>&` (XML client configuration), and `@`, `#`, `%` and `:` (URL-style client settings).
    - **Required classes**: lower case, upper case and digits always. Special characters are
      required when `requireSpecialCharacters` is set, or when the policy is unknown.
    - **Pool**: the union of the required classes.
    - **Method**: one character from each required class, then `L − k` from the pool, then a
      Fisher–Yates shuffle. The randomness is `crypto.getRandomValues` with rejection sampling on
      32-bit values, so there is no modulo bias.
    - **Entropy**: 16 characters from 57 symbols is about 93 bits.
  - **Policy rules** (`password/policy-rules.ts`): from `PasswordPolicy`, the visible rules in
    this order. Each is evaluated live against the typed value with the policy's own definitions:
    length in UTF-8 bytes, letters `[A-Za-z]`, digits `[0-9]`, special = anything else, mixed case
    = both `[a-z]` and `[A-Z]`.

    | Rule | Shown when | Legacy key |
    |---|---|---|
    | Minimum length | always | `admin.password_policy_length` |
    | Letters | `requireLetters` | `admin.password_policy_chars` |
    | Digits | `requireDigits` | `admin.password_policy_numbers` |
    | Special characters | `requireSpecialCharacters` | `admin.password_policy_special_chars` |
    | Lower and upper case | `requireMixedCase` | `admin.password_policy_lowerupper` |

    `PasswordPolicyHints.vue` lists them before typing. Each rule carries an icon plus visually
    hidden "met" or "not met" text, so the state is never conveyed by colour alone. The marks
    never block submission (clarification).

    The same evaluator is the oracle of SC-008: a unit test generates 10,000 passwords for each of
    the 16 combinations of the four flags at minimum lengths 0, 6, 16, 17, 32 and 64.
  - **Policy read**: `getPasswordPolicy` with `staleTime: 0` and `refetchOnMount: 'always'`, so it
    is read whenever a password form opens (FR-030). A `503` or another failure shows "The password
    rules are unavailable". The generator then applies the default rules, and submitting stays
    possible. A `422` on `password` refetches the policy (edge case "policy changed").
  - **Pre-hashed notice**: a value that matches `^\{[A-Za-z0-9-]+\}` gets the notice "If {scheme}
    is a hash scheme the server recognises, the value is stored as a pre-hashed password without
    the policy check" (FR-030). The contract names only examples of the recognised prefixes, so the
    notice is worded as a hint for any prefix, and the API decides (plan API gap B). For the
    documented prefixes this is the notice FR-030 asks for.
  - **Memory hygiene** (FR-074, SC-009):
    - The password exists only in the form's local `ref`, never in a query, route, store or log.
    - Requests that carry a password (`createMailbox`, and `updateMailbox` with `password`) never
      go through TanStack Query. They go through UI 001's `useSecretRequest`, a direct client call
      with loading, error and result state (`docs/conventions.md`, "Secrets in requests or
      responses"). Only the non-secret response
      is written to the query cache afterwards. No draft of these forms is ever saved.
    - The field is cleared after a successful submit and on unmount.
    - The generated password is created in the browser and typed into the field like any other
      password, so it is shown in the field as the clarification decides. `OneTimeSecretDialog` is
      for secrets the server generates and returns once (conventions "Secrets").
    - The problem mapping never echoes request values.
    - The page title never contains form values.
- **Rationale**:
  - The clarifications define the rules.
  - Rejection sampling is the standard way to get uniform indexes from CSPRNG bytes.
  - Evaluating with the API's documented definitions keeps the hints honest.
  - TanStack keeps mutation variables in its mutation cache, so `useSecretRequest`'s direct client
    call is what keeps the password out of every cache (FR-074, conventions).
- **Alternatives considered**:
  - A pronounceable generator, as legacy has: rejected. It ignores the required classes
    (clarification).
  - A password library: rejected under VIII; the generator is about 40 lines.
  - A stricter special set without `?` and `!`: unnecessary, because both are accepted by IMAP,
    SMTP AUTH and ActiveSync clients.

### R9. Create screen: template application, quota pre-fill and the request (FR-018 to FR-027)

- **Decision**:
  - **Layout**: one page (`MailboxCreatePage.vue`), with no steps and no modal.
    - The essentials come first: local part with the domain suffix and the normalised address
      preview, domain, display name, template, password, and quota.
    - Then five `CollapsibleGroup` sections (Reka `Collapsible`), each with a one-line summary of
      its values:
      1. status and access;
      2. protocol access;
      3. user permissions;
      4. tags;
      5. initial settings managed later: tagged-mail handling, quarantine notification and
         category, TLS in and out, rate limit.
    - The field components are shared with the template form (R14).
  - **Templates**: `listMailboxTemplates` with `sort=name`, reading every page with the API's
    default page size until `meta.total` is reached (templates number in the tens, so one or two
    requests). Default comes first, and it is preselected unless `?template=` names a valid one.
    - The initial application fills the template-driven fields without asking.
    - A later template choice checks `touched`. When the user changed any template-driven field,
      `useConfirm` asks "Replace your changes with the values of {template}?".
      - Confirming overwrites every template-driven field and clears `touched`.
      - Cancelling restores the previous template choice and changes nothing (FR-021).
  - **Domain**: `DomainPicker` (single) over `listDomains`. `?domain=` preselects the domain
    (FR-005, FR-020). The chosen domain is read with UI 002's domain detail query (`getDomain`) for
    fresh figures:
    - `usage.mailboxesLeft`: at 0 or below, "The domain has no mailboxes left", and submitting stays
      possible (edge case);
    - `usage.defaultNewMailboxQuota` and `usage.maxNewMailboxQuota`: shown as "max. X";
    - `active` and `backupMx`: shown as notes.

    A `maxNewMailboxQuota` of 0 means that no quota is left for limited mailboxes:
    - **administrators** see `warning.quota_exceeded_scope`, with the quota fixed to unlimited;
    - **domain administrators without `unlimitedQuota`** see that no mailbox can be created there,
      and the submit action is disabled (US2-AS9).
  - **Quota pre-fill** (`src/features/mailboxes/quota.ts`, pure):
    - the domain's `defaultNewMailboxQuota` when the template is the Default template;
    - the same when the template's quota is unlimited (0) and the caller may not give an unlimited
      quota;
    - otherwise the template's quota, with 0 shown as the "Unlimited" switch.

    It is recomputed when the domain or the template changes, unless the user changed the quota.
    Above `maxNewMailboxQuota`, the field shows an error with the maximum before submitting
    (FR-022, US2-AS2).
  - **Authentication source**: the options are `MailboxCapabilities.authSources`, the built-in
    source labelled with the product name. The default is `mailcow`. When the capabilities cannot
    be read, only `mailcow` is offered. This closes spec API gap 1: FR-024 offers external sources
    "once the contract reports the configured provider type", and the capabilities now report it.
  - **Request** (`src/features/mailboxes/create-request.ts`, pure, FR-025). It always contains:
    - `localPart`, trimmed and lower-cased;
    - `domain`;
    - `templateId`;
    - `quota`, the bytes shown, or 0 for unlimited;
    - `password`, unless the source is external;
    - `authSource`, when it is not `mailcow`;
    - `displayName`, when it is not empty.

    Every template-driven field is sent only when it differs from the template's value. Protocol
    and permission objects carry only the members that differ, and they are left out when empty.
  - **Sending**: the request carries the password, so it goes through UI 001's `useSecretRequest`,
    never through `useMutation` (R8).
  - **After success**: the response (without `creationReport`) is written to the detail cache, and
    lists, tags and domains are invalidated. Then:
    - the route is replaced with the new detail screen;
    - `success.mailbox_added` is announced;
    - an alert offers "Add another mailbox" (`/mailboxes/new?domain=…&template=…`, FR-026).

    When `creationReport` has a `failed` step, the alert also lists it with its translated meaning:
    - the rate limit was not applied;
    - the tagged-mail handling was not applied;
    - the webmail address book was not updated.

    The report is handed to the detail page through a module-level one-shot in memory.
  - **Refusals** (FR-027): every entry is kept, including the password. The refusals are mapped as
    follows:
    - `409 address-in-use` → the local part field, naming the holder;
    - `409 mailbox-limit-reached` → a message with the count and limit, and the domain is
      refetched;
    - `422` → field errors;
    - `403 attribute-not-permitted` → R6;
    - `422 notFound` on `templateId` → reload the templates and ask the user to choose again;
    - a network failure → a message, with everything kept (US2-AS10).
- **Rationale**:
  - The clarifications fix the layout and the pre-fill.
  - Sending only differences relies on API FR-006, so values equal to the template are not a
    choice and never trip a flag.
  - Reading the domain on choice keeps the limits current.
  - Reporting failed follow-up steps keeps the user from believing that a rate limit is in place
    when it is not.
- **Alternatives considered**:
  - Sending the whole form: rejected, because it trips domain administrators' flag checks.
  - A three-option dialog (replace, keep mine, cancel): rejected as more complex than the spec
    needs.
  - Ignoring `creationReport`: rejected, because it is silent about failures the API documents.

### R10. Quota entry and usage display (FR-011, FR-034)

- **Decision**:
  - `MailboxQuotaField.vue` combines the promoted `QuotaField` (number plus MiB, GiB or TiB, whole MiB,
    at least 1 MiB, stored value shown in the largest exact unit) with:
    - an "Unlimited" switch, shown only when the caller may give an unlimited quota:
      administrators; domain administrators with `unlimitedQuota`; or, in the general section, a
      mailbox that is already unlimited (FR-041);
    - "max. X", from `largestAllowedQuota` (edit) or `maxNewMailboxQuota` (create). A larger value
      is refused before submitting;
    - a warning when the value is below `quotaUsed`: "Mail delivery may be refused once the mailbox
      is over quota". It does not block (edge case).

    Typing 0 never means unlimited: `QuotaField` refuses 0.
  - `MailboxQuotaUsage.vue` shows usage:
    - an unlimited quota is the word "Unlimited", with no bar or percentage;
    - otherwise the promoted `UsageMeter` (R4) with `percentUsed` from the API and thresholds of
      75 % (warning) and 90 % (critical);
    - the percentage as text, formatted with `Intl.NumberFormat` style `percent` ("92%" in en-gb,
      "92 %" in cs-cz and sk-sk);
    - used and total in binary units with `formatBytes`;
    - the state ("Nearly full", "Full") in visually hidden text, so it does not depend on colour.
- **Rationale**: These are the clarified rules. The thresholds are the legacy list's. The API
  computes `percentUsed` and sorts unlimited mailboxes last.
- **Alternatives considered**: Computing the percentage in the browser: rejected, because the API
  provides it, rounded the same way as legacy.

### R11. Domain administrator gating (FR-003, FR-041 to FR-043, SC-010)

- **Decision**: `src/features/mailboxes/acl.ts` is pure and unit-tested over the full flag matrix.
  - **Gate map** (field to flag): `protocolAccess.*` → `protocolAccess`; `webmailRedirect` →
    `sogoAccess`; `rateLimit` (create, templates) → `ratelimit`; unlimited quota →
    `unlimitedQuota`.
  - **`gate(field, identity, context)`** returns `editable`, `readOnly` (with the flag to name) or
    `hidden`.
    - Administrators: always `editable`.
    - Domain administrators: governed by `identity.permissions`.
  - **Read-only display**: a read-only control shows the current or template value with
    `AclReadOnlyNote.vue` ("Prohibited by ACL" from `acl.prohibited`, plus the permission's legacy
    label, for example `acl.protocol_access`).
  - **Omitted user permissions** (FR-042): a permission is shown only when the key is present in
    `userPermissions`. When the caller is a domain administrator and any of the 15 keys is absent,
    the section says "Some permissions are hidden by your own permissions".
  - **Bulk**: the protocol actions are hidden without `protocolAccess` (FR-053).
  - **Refusals**: `attribute-not-permitted` and `permission-flag-required` refetch the identity
    (UI 001 FR-050), so the gates follow at once.
- **Rationale**: Hiding is a convenience (constitution V), and every refusal is still handled
  (FR-043). A table-driven test proves SC-010's "100 % of gated controls".
- **Alternatives considered**: Deriving the gates from refused requests only: rejected, because the
  user would see controls they cannot use.

### R12. Bulk actions (FR-053 to FR-057)

- **Decision**:
  - **Selection**: UI 002's `useBulkSelection`, keyed by address. Each item stores
    `BulkTarget { id: address, version }` from the list entry, so outdated items are refused per
    item (conventions). `version` is the entry's `etag` without its surrounding quotes, as
    `BulkTarget.version` requires and UI 002's `toBulkTargets()` does; `If-Match` headers send the
    `etag` unchanged.
    - The selection holds the current page only. It clears with an announcement on every list-state
      reset.
    - `useBulkSelection` takes the limit from `MailboxCapabilities.bulkLimit` (at most 100).
      "Select all" selects the visible mailboxes up to the limit (the first N) and states the
      limit; once the limit is reached, further selection is disabled with the same message
      (`docs/conventions.md`, "Bulk limit", which applies to every list). With the default limit and
      the largest page size, both 100, "Select all" always covers the whole page.
  - **Selection mode** (FR-057, conventions "Bulk actions"): as in UI 002, a "Select" button enters
    an explicit selection mode at every width. Cards get a checkbox of at least 44 × 44 px, the
    table gets its checkbox column and the "Select all on this page" header, and UI 002's
    `BulkActionBar` shows the count, the actions and "Cancel", fixed at the bottom below `md`.
  - **Actions** (`src/features/mailboxes/bulk.ts`): `activate`, `disableLogin`, `deactivate`,
    `delete`, and "Allow protocol…" and "Disallow protocol…", whose dialog has a radio group of the
    six protocols. Each definition carries its label, its effect text (the FR-035 texts), its
    confirm label and its gate.
  - **Confirmations**:
    - every action: one `useConfirm` dialog naming the action, its effect and the count;
    - deletion: also lists every selected address, states the kinds of data removed and the
      retention from `garbageRetentionMinutes`, and requires the count to be typed (`requireTyped`,
      FR-055).

    There is no per-mailbox preview in bulk, because 100 preview requests would be needed.
  - **Request**: `POST /mailboxes/bulk-actions` with `{ action, protocol?, targets }`.
  - **Result**: `BulkResultSummary` (UI 002) shows the counts of `summary` (done, not found,
    refused, outdated, failed) and one row per `results` item with the translated outcome and,
    for refused, outdated and failed items, the problem type's message. The summary is announced.
    - Items that were refused, outdated or failed stay selected, and the others are deselected
      (conventions "Bulk actions", the orchestrator's decision recorded in the spec's
      clarifications).
    - The list is refetched. The retained items take the new `version` of their refreshed entries,
      and items no longer on the page are dropped from the selection.
  - **Whole-request refusal**: `403 permission-flag-required`, `forbidden` or `422` (for example
    `tooMany` after the operator lowered the limit) gives one message naming the reason. The
    selection is kept.
  - **No response** (network failure): "The outcome is unknown". The list is refetched and the
    request is never repeated. The selection is kept, with refreshed versions, so the user can
    check it; items no longer on the page are dropped.
- **Rationale**: These are API FR-054, FR-055 and FR-067, and the conventions' bulk rules. Typing
  the count guards the one action that can delete 100 mailboxes.
- **Alternatives considered**: Selections across pages: rejected by the conventions. Fetching 100
  deletion previews for the bulk dialog: rejected as heavy, because the dialog states the kinds
  and the retention instead.

### R13. Deletion (FR-045 to FR-047, US4)

- **Decision**: `MailboxDeleteDialog.vue` is a Reka `AlertDialog` with the initial focus on
  "Cancel".
  - **On open**: `previewMailboxDeletion` with query key `['mailboxes', 'deletion-preview',
    address]`, `staleTime: 0` and `gcTime: 0`. While it loads, the dialog shows the name and a
    stable placeholder layout. The dialog then shows:
    - the address;
    - `mail.storageUsed` and `mail.messageCount`;
    - "The mail moves to the server's garbage area and is purged after {retention}", where the
      retention is `garbageRetentionMinutes` formatted with `formatDuration` as days, hours or
      minutes. No product name is hard-coded (constitution IV);
    - the aliases that will be deleted (`exclusiveAliases`: count plus up to 100 addresses in a
      scrollable list);
    - the aliases that keep their other recipients (`sharedAliases`: count);
    - every kind of data the spec lists (FR-045), each with its number from `counts` or, for the
      `present` flags, "yes" or "no". Kinds with a number above 0 come first. The kinds with
      nothing stored are listed in one line ("Nothing stored for: …"), so the list stays short on a
      phone and still names every kind. Passkeys are named as passkeys.
  - **Blockers**: when `canProceed` is false, the dialog names each blocker (the mail store or the
    shared store is unreachable), disables "Remove", and offers "Check again".
  - **Version**: the dialog compares `preview.etag` with the version the screen read (the list
    entry or the detail).
    - If they differ, the cached mailbox is refetched and the dialog says that the mailbox changed
      since it was opened, so the user confirms against current data (US4-AS4).
    - The deletion is sent with `If-Match: preview.etag`.
  - **Outcomes**:
    - `204`: `success.mailbox_removed` is announced, the detail and preview caches are removed,
      and lists, tags and domains are invalidated. A detail screen goes back to the list (FR-046).
    - `412`: the preview and the mailbox are reloaded, and the dialog asks again.
    - `404`: "The mailbox no longer exists", and the list is refreshed.
    - `503 temporary-failure`: "The mailbox was not deleted. Nothing was removed. Try again later"
      (FR-047). The mailbox stays.
    - `504 outcome-unknown` (step `mailStoreCleanup`): "It is unknown whether the mail store moved
      the mail. No records were removed, and the deletion can be retried later". The list is
      refreshed. The problems documentation says a retry is safe.
- **Rationale**: The conventions require the delete preview where one exists. API FR-065 adds it
  for exactly this dialog. This closes spec API gap 4.
- **Alternatives considered**: Listing only the kinds of data: superseded by the preview. Using
  the screen's tag for `If-Match`: rejected, because the dialog shows newer data than the screen.
  The comparison above gives the same protection.

### R14. Templates (FR-058 to FR-063, US7)

- **Decision**:
  - **List**: `MailboxTemplatesPage.vue` uses `useListState` with `q`, `sort` (`name`, `id`,
    `createdAt`, `modifiedAt`; default `name`), `order`, `page` and `size`.
    - Below `md`, cards show the name, quota, status, protocols in one line (for example "IMAP,
      SMTP, Sieve, DAV"), the webmail redirect, the forced flags, the rate limit, the tags and the
      modification time.
    - From `md` up, a table shows the same.
    - Administrators get "Add template".
  - **Create**: `/mailbox-templates/new`, administrators only, one sectioned form.
    - It reuses the field groups of the create screen (R9).
    - It starts with the built-in defaults documented in `MailboxCreateRequest` and
      `MailboxTemplateCreateRequest`: unlimited quota, active, no forced password change or
      second-factor setup, webmail redirect on, all six protocols, no TLS enforcement, no
      tagged-mail handling, hourly quarantine notifications of rejected mail, no rate limit, and
      every user permission except `syncjobs` and `sogoProfileReset`.
    - These live in `src/features/mailboxes/templates/built-in-defaults.ts`, typed as the
      generated `MailboxTemplateCreateRequest`, with a comment citing the contract.
    - The request sends the name and **every value the form shows**, so the template is exactly
      what the user saw, even if an operator changed the server defaults (plan API gap C).
  - **Detail**: `/mailbox-templates/:templateId`, using UI 002's `EditableSection` for each group:
    1. name and tags;
    2. quota and status (quota, status, forced flags, webmail redirect);
    3. protocol access;
    4. user permissions;
    5. initial settings.

    Each group saves only its changed values with `If-Match` (FR-061), and outdated saves follow
    R6. For the Default template (`isDefault`), the name is read-only, and there is no delete action
    but a short explanation (FR-061).
  - **Delete**: `useConfirm` names the template and says that mailboxes created from it do not
    change (FR-062). The deletion is sent with `If-Match`.
    - `412`: reload and confirm again.
    - `404`: refresh.
    - `409 mailbox-template-protected`: an explanation.
  - **Errors**: `409 mailbox-template-name-exists` is shown on the name field (FR-060).
  - **Domain administrators** see the list and the detail read-only. The create route carries
    UI 002's `meta.roles: ['admin']`, so `ShellLayout` renders `NoAccessState` for them (FR-063).
- **Rationale**: Per-group saves follow the conventions' editing rule. Sending all values at
  creation makes the form honest (US7-AS2).
- **Alternatives considered**: Sending only the name and relying on the server's defaults:
  rejected, because the form could show values that differ from what is stored.

### R15. Rename (FR-048 to FR-052, US8)

- **Decision**: `RenameSection.vue` works in this order.
  1. When `status` is `inactive`, renaming is unavailable with the reason, and there is a link to
     the general section to activate the mailbox (FR-050). Nothing else renders.
  2. The legacy warning (`edit.mailbox_rename_warning`) and the checkbox "I have created a backup."
     (`edit.mailbox_rename_agree`) come first. The form appears only once the box is checked
     (FR-048).
  3. **The form** has:
     - the new local part, with the fixed domain suffix, checked by the local-part rules (R18). A
       value equal to the current local part without regard to letter case is refused ("A change
       of letter case only is not a rename");
     - a required radio group "Keep the old address as an alias" with "Yes" and "No" and nothing
       preselected (FR-049). The form cannot be submitted until both are given.
  4. **Submit** opens one confirmation that names both addresses and the alias choice. Confirming
     sends `POST /mailboxes/{address}/rename` with `If-Match`.
  5. **Outcomes**:
     - `200 MailboxRenamed`: the old detail key is removed, the response is written under the new
       address, and lists are invalidated. The route is replaced with
       `/mailboxes/<new>`, and `success.mailbox_renamed` is announced with both addresses (FR-051).
     - `409 address-in-use`: the new local part field names the holder.
     - `409 mailbox-not-renamable`: the reason, and the mailbox is refetched.
     - `409 domain-alias-limit-reached`: the count and limit, with the suggestion to rename without
       keeping the old address.
     - `412`: the mailbox is reloaded and the user confirms again.
     - `422`: field errors, for example `unchanged`.
     - `503 temporary-failure`: "The mailbox keeps its old address. Try again later". When `steps`
       is present it is shown collapsed.
     - `500 mailbox-rename-incomplete`: `RenameReport.vue`, a persistent `role="alert"` panel that
       stays until dismissed and does not navigate. It shows both addresses and every step with
       its translated outcome (`done`, `undone`, `notDone`, `failed`, `unknown`, `undoFailed`,
       `skipped`), and advises contacting the server operator. Both addresses are refetched, and
       lists are invalidated (FR-052).
     - `504 outcome-unknown`: the same panel, naming the step whose outcome is unknown and saying
       that every step known to be done was undone. It advises checking the mailbox under both
       addresses and asking an administrator (problems documentation).
- **Rationale**: These are API FR-043 to FR-048 and the problems documentation's client actions.
  The persistent report keeps a dangerous partial state visible.
- **Alternatives considered**: A checkbox for keeping the alias: rejected by the clarification.
  Navigating after an incomplete rename: rejected by FR-052.

---

## 5. Server settings, errors and audit

### R16. Capabilities (API FR-064; conventions "Capabilities and limits")

- **Decision**:
  - `getMailboxCapabilities` is cached under `['mailboxes', 'capabilities']` with a five-minute
    `staleTime`.
  - It is read by the list (`bulkLimit`, `lastLoginsReported`), the create and section forms
    (`authSources`, `groupwareEnabled`, the tag and attribute limits) and the delete dialogs
    (`garbageRetentionMinutes` for bulk).
  - **`groupwareEnabled: false`** hides the webmail redirect control everywhere, as legacy does.
    The overview shows "Webmail is disabled on this server" instead. This closes spec API gap 2.
  - **When the read fails**:
    - bulk actions are unavailable, with a retry;
    - forms offer only the built-in source;
    - client-side limit checks that need a capability are skipped, so the API decides;
    - nothing falls back to hard-coded limits (conventions).
- **Rationale**: The conventions say that limits and enabled server features come from the
  capabilities read. API FR-064 was added for these gaps.
- **Alternatives considered**: Shipping the documented defaults as fallbacks: rejected, because
  "the UI never hard-codes them".

### R17. Problems, rule codes and the audit log (FR-068, FR-064, conventions "History and audit")

- **Decision**:
  - **Problem types**: the problem types and validation rule codes of API 003 are translated
    through UI 001's `problems.ts`, with keys `problem.<name>` and `validation.<code>`. Under
    constitution IV 1.3.0, each one is first mapped to the legacy `danger.*` or `warning.*` key of
    the same meaning (for example `address-in-use` → `danger.is_alias_or_mailbox`,
    `mailbox-limit-reached` → `danger.max_mailbox_exceeded` with `count` and `limit`, a quota above
    the domain limit → `danger.mailbox_quota_exceeded` or `danger.mailbox_quota_left_exceeded` in
    MiB, `missingCharacterClass` → `danger.password_complexity`, a duplicate template name →
    `danger.template_exists`), recorded in the legacy form map (T008a). The new strings below
    remain only where legacy has no equivalent. The feature-specific variants live in
    `src/features/mailboxes/problems.ts` (pure, unit-tested):
    - the holder of `address-in-use` → `mailboxes.problem.addressInUse.<holder>`;
    - `mailbox-limit-reached` and `domain-alias-limit-reached` with `count` and `limit`;
    - `temporary-failure` per `dependency` (`mailStore`, `webmail`, `sharedStore`, otherwise the
      generic text);
    - `outcome-unknown` per operation;
    - `attribute-not-permitted` → field errors from `attributes`, with the flag label from
      `requiredFlags`;
    - `permission-flag-required` → the labels of `requiredFlags`;
    - the rename steps.

    The full table is in [contracts/README.md](./contracts/README.md).
  - **Rule parameters**:
    - `outOfRange` on a quota carries `max` in bytes and `limit` (`maxMailboxQuota`,
      `domainQuotaLeft`, `largestAllowedQuota`). It is rendered as "At most {max}" with
      `formatBytes` and a limit-specific phrase.
    - `missingCharacterClass` uses `characterClass` (`letter`, `digit`, `special`,
      `lowerAndUpper`).
    - `tooShort` on `password` names the policy minimum.
    - `conflictsWith` uses `field` and `value`.
    - `invalidFormat` adds the formats `localPart`, `email` and `attributeName`.
    - `notEligible` uses `kind: aliasDomain`.
  - **Field paths**: errors map to fields by their dot path: `protocolAccess.pop3`,
    `userPermissions.syncjobs`, `tags.3`, `customAttributes.<name>`, `rateLimit.value`,
    `newLocalPart`, `name`. For `customAttributes.`, everything after the first dot is the
    attribute name, because attribute names may contain dots.
  - **Audit log labels**: UI 003 adds labels on UI 001's audit log screen for the event types
    `mailboxCreation`, `mailboxUpdate`, `mailboxDeletion`, `mailboxRename`,
    `mailboxTemplateCreation`, `mailboxTemplateUpdate` and `mailboxTemplateDeletion`, the target
    types `mailbox` and `mailboxTemplate`, and the failure reasons `outcomeUnknown` and
    `partiallyCompleted`. It also adds the shared reasons, unless UI 002 already labels them.
  - **Audit record details**: `AuditEvent.details` is
    `{ type: object, additionalProperties: true }` in the contract, and the members of mailbox
    records (`changes`, `passwordSet`, `preHashed`, `previousAddress`, `newAddress`,
    `bulkRequestId`, `steps`) are documented only in API research R22.
    - UI 001's generic details renderer shows them as text in a definition list, and nested
      objects as nested lists.
    - UI 003 adds translated labels for these keys only, with a fallback to the raw key. That is a
      translation table keyed by strings, not an API type (constitution I).
    - Values stay raw (for example quota bytes) until the contract describes the details (plan API
      gap A). US9-AS1 is met at that level: both records appear newest first, the quota change
      with its old and new value, and the password record labelled "Password set" with no value.
- **Rationale**: The constitution requires translation by `type` and code, and forbids
  hand-written API types. The conventions put audit labels on the audit log screen.
- **Alternatives considered**: Typing `details.changes` by hand: rejected by constitution I.
  Hiding details until the gap closes: rejected, because the generic view is already useful.

### R18. Client-side validation (FR-019, FR-034, FR-036, FR-038, FR-039, FR-049, FR-060)

- **Decision**: `src/features/mailboxes/validation.ts` is pure and unit-tested. The rules come from
  the contract and the spec, and data-model §6 lists them all. The highlights:
  - **Local part**: trimmed and lower-cased; 1–64 characters of
    `` [A-Za-z0-9!#$%&'*+/=?^_`{|}~.-] ``; no leading, trailing or doubled dot; the full address at
    most 255 characters.
  - **Recovery e-mail**: empty, or `^[^\s@]+@[^\s@]+\.[^\s@]+$` and at most 255 characters. The
    API's `invalidFormat: email` is authoritative.
  - **Custom attribute names**: `^\S+$`, 1 to `customAttributeNameMaxLength` characters, unique
    case-sensitively, as object keys are. Values: at most `customAttributeValueMaxLength`
    characters.
  - **Static schema limits** (`displayName` 255, `password` 255, template `name` 255, the rate
    limit 1–2,147,483,647) join UI 001's `src/shared/validation/limits.ts` pattern. A unit test
    compares each with `contract/openapi.json`. The configurable limits come from the capabilities
    (R16).
  - Attributes and tags stored by legacy beyond the limits are shown in full. Only values the user
    adds or changes are checked, as the API does (API `MailboxCustomAttributes`, `MailboxTagSet`).
- **Rationale**: Checking before submitting is faster on a phone, and the API stays authoritative.
- **Alternatives considered**: A validation library: rejected (UI 001 R1).

---

## 6. Cross-feature integration, tests and budgets

### R19. Entry points and designated action areas (conventions "Where features meet")

- **Decision**:
  - **Into earlier screens** (UI 003 adds them when implemented):
    - UI 002 domain detail, in its designated action area: "Mailboxes" →
      `/mailboxes?domain=<name>` and "Add mailbox" → `/mailboxes/new?domain=<name>` (FR-005).
      The create screen itself says when the domain has no mailboxes left.
    - UI 002 domain list: the mailbox usage pair of each card and row links to
      `/mailboxes?domain=<name>`.
    - UI 002's "delete unavailable: N mailboxes must be removed first" text links to the same
      filtered list.
    - UI 001 catalogue: the `mailboxes` entry becomes available, and a new `mailboxTemplates` entry
      (`/mailbox-templates`, administrators and domain administrators) is added. The home screen's
      shortcuts follow the catalogue automatically.
    - UI 001 audit log: labels (R17).
  - **Designated action areas for later features**, documented in data-model §8:
    - `MailboxRowActions.vue`: the list row and card menu. UI 007 adds "Sign in as" and "Open
      webmail as".
    - `MailboxSectionNav.vue` and the detail child routes: UI 004 adds "Send as", and UI 009 adds
      "Relayhost".
    - `ManagedSettingsGroup.vue`: each read-only entry of FR-040 has an optional link, which UI 005,
      006 and 009 fill.
    - `MailboxBulkActions.vue`: UI 005 and 006 add the TLS and quarantine bulk actions.

    Until those features ship, nothing is shown for them (conventions): no placeholder and no
    broken link. Each FR-040 entry names its managing feature as text.
- **Rationale**: This is the conventions' rule. Named components keep later edits local, with no
  plug-in registry (VIII).
- **Alternatives considered**: A runtime extension registry: rejected as speculative.

### R20. Mock API, test data and budgets (constitution VI, VII)

- **Decision**:
  - **Handlers** (UI 001 R22), each wrapped by the contract validator:
    - one module per operation group, so that stories never edit the same handler file:
      `mailboxes-read.ts` (list, get, capabilities, tags), `mailbox-update.ts`, `mailbox-create.ts`,
      `mailbox-deletion.ts` (preview, delete), `mailbox-bulk.ts`, `mailbox-rename.ts`,
      `mailbox-templates.ts` (5 operations) and `password-policy.ts`, all in `tests/mocks/handlers/`.

    The domain operations are UI 002's `tests/mocks/handlers/domains.ts`. The scenarios of this
    feature seed domains through UI 002's domain factory.
  - **What the handlers model**:
    - scope by role and domain assignment;
    - filters, `q`, sorting with missing values last, and paging;
    - `ETag` headers and `If-Match` with `412`;
    - Merge Patch semantics and `immutable`;
    - template defaults at creation, and the domain's default quota when no template is named;
    - domain limits, with the domain's usage updated so UI 002's figures stay consistent;
    - the password policy check, and pre-hashed values;
    - the flag checks with `attribute-not-permitted` and `requiredFlags`;
    - the deletion preview from seeded dependent counts;
    - bulk per-item outcomes;
    - rename outcomes;
    - template uniqueness and Default protection;
    - audit records for every mutation, so the History tests work.
  - **Failure injection**: by operation, and by target for bulk. It covers `503` per dependency,
    `504`, rename `500 incomplete` and `503` with steps.
  - **Scenarios** (`tests/mocks/scenarios/mailboxes/<story>.ts`, each registered in the index):
    - `admin-mailboxes-10k`: 10,000 mailboxes in 500 domains, generated deterministically from a seeded
      generator when the scenario is created (US1's independent test, SC-001, SC-003);
    - the per-story scenarios listed in tasks.md.
  - **Budgets**:
    - Every route of this feature is a lazy chunk.
    - The bundle budget (UI 001 R26) prints their sizes.
    - `scripts/run-lhci.mjs` gains a third collection: `/ng/mailboxes` with
      `MOCK_DEFAULT_SCENARIO=admin-mailboxes-10k`. Lighthouse's performance score of at least 0.9
      on the mobile preset is the automated proxy for SC-003. The manual measurement on a phone
      (T130) records the 2-second figure.
- **Rationale**: Constitution VI and VII. Deterministic data makes the 10,000-mailbox tests
  repeatable.
- **Alternatives considered**: Fixtures in JSON: rejected (UI 001 R22). A real dataset in the
  smoke suite: the smoke suite checks the integration, not volume.
