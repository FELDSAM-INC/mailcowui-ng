# Cross-feature UI conventions

These decisions apply to every UI feature. They were collected while UI features 001–014 were
being specified. A feature spec governs its own screens. Where a spec is silent, or contradicts
another UI spec, this document applies, and the next change to that spec aligns it. Every plan
reads this document next to the constitution. The API side has its own rules in
`../mailcow-rest-v2/docs/conventions.md`.

## Feature entry points

Other features use a feature through its `index.ts`. The application's route registry
(`src/app/router/routes.ts`) may also import its declarative `routes.ts`, whose components and
messages stay lazy. This narrow exception avoids loading the feature's public form components
and API composables while registering routes. ESLint permits it only in the route registry;
other deep imports remain forbidden. Route modules must not import another feature's form/API
barrel just to reuse a page loader.

## Mobile data tables

Below the table breakpoint, use `shared/components/DataCard.vue` for each row. Domains and
Aliases are the reference layouts: identity, selection and `RowActions` share the header;
secondary data uses the optional `details` slot and its bottom disclosure, collapsed initially.
Keep short lists of values visible. A single action stays a direct button, multiple actions use
the existing menu, and History stays on the edit screen.

Use `DataCardFields.vue` for compact label/value pairs, `data-wide` on a grouped pair for long
values, and `inline` for short boolean flags. Render booleans with the shared `YesNoMark.vue`
(check/cross plus an accessible Yes/No label). Small value or statistics tables that already fit
on a phone can remain tables. Desktop tables retain their shared `table-frame` and `data-table`
styles.

## Wording

These rules apply to the app's new strings. Text with a classic-interface equivalent always comes
verbatim from mailcow's language files (see "Translations and forms").

- New strings call the legacy UI **"the classic interface"**: "klasické rozhraní" in Czech,
  "klasické rozhranie" in Slovak. They never call it "legacy".
- FIDO2 credentials are called **passkeys** (owner decision). Texts about passkeys are therefore
  new strings, even where a legacy `fido2.*` or `tfa.*` key covers the same element.
- Screen names, section names and menu entries are the legacy ones, through their legacy keys, for
  example "Sender-dependent transports" (UI 009).

## Translations and forms (owner rule, 2026-10-18)

The owner: "Regarding translations: we have to include all mailcow has, 1:1. These were
contributed by real people, not machine-created. So we have to use them 1:1, and basically the
whole UI forms have to be 1:1." Constitution IV (1.3.0) makes this binding. Every UI feature
follows the rules below, and they override any earlier spec, plan, research or task text that
says otherwise. UI 001 owns the mechanism (the loader, the bundled snapshot, the formatter and
the key checks). Features only use legacy keys and add the few new strings they need.

### Languages

- The app supports every language mailcow ships, the 33 `data/web/lang/lang.<code>.json` files:
  az-az, bg-bg, ca-es, cs-cz, da-dk, de-de, en-gb, es-es, fi-fi, fr-fr, gr-gr, hu-hu, it-it,
  ja-jp, ko-kr, lt-lt, lv-lv, nb-no, nl-nl, pl-pl, pt-br, pt-pt, ro-ro, ru-ru, si-si, sk-sk,
  sv-se, tr-tr, uk-ua, uz-uz, vi-vn, zh-cn, zh-tw.
- Locale identifiers are mailcow's codes. They are converted to BCP 47 only for `Intl` and
  `<html lang>`.
- The languages offered are the server's `languages` (from `GET /public-config`) intersected with
  these 33.

### Where legacy text comes from

- **At runtime, from the installation.** mailcow serves its language files publicly on the same
  origin as `/lang/lang.<code>.json` (verified on the staging host: 200, `application/json`).
  Reading them is the one non-API request constitution I allows, so the cutover (UI 014) must keep
  `/lang/` served. The app loads the installation's own files, so it shows exactly the text that
  installation's classic interface shows:
  - the FeldHost fork's human-made Czech and Slovak additions, and its wording, which names
    "FeldHost™ Mailhosting" where upstream says "mailcow";
  - any customisation by the operator;
  - the texts of the installed mailcow version, without an app release.
- **Bundled snapshot.** A snapshot of upstream `en-gb` at baseline `2026-09a` is bundled. It is
  used to type-check the legacy keys the app uses, and as the fallback when `/lang/` cannot be
  loaded.
- **Missing keys.** A key missing in the selected language falls back to `en-gb`, as the classic
  interface does (`data/web/inc/prerequisites.inc.php` merges the selected file over `en-gb`).
  Features never fill a gap with their own value: no hand-written value for a legacy key, in any
  language.

### No text change of any kind

- A legacy value is shown exactly as the file has it: no rewording, no shortening, no stripped
  glyphs (`> Forgot Password?` keeps its `>`), no trimming, no case change, no removed unit (the
  `(MiB)` in `add.quota_mb` stays).
- A legacy string is shown whole. It is never cut into parts or joined with other text to make a
  different sentence.
- **Placeholders**: `%s` and `%d` are converted mechanically and filled in order with what the
  classic interface fills them with. For example, `edit.force_pw_update_info` gets the product name
  (`ui_texts.main_name` in legacy, the branding configuration in the app), and
  `success.mailbox_added` gets the mailbox address. The legacy form map names each placeholder's
  source.
  - The `datatables.*` texts use DataTables' own placeholders (`_START_`, `_END_`, `_TOTAL_`,
    `_MAX_`, `_MENU_`), which are substituted the same way.
  - Braces in legacy values (`{username}`, `{link}`, `{date}` and so on, the variables of e-mail
    templates) are literal text and are never interpreted.
- **HTML**: about a hundred legacy values contain HTML (`<b>`, `<br>`, `<code>`, `<a>`, lists).
  They are rendered through `SanitizedHtml.vue` with a small allowlist that UI 001 defines, and
  never altered. They are not refused, rewritten or replaced by a new string.
- **Formatting**: legacy strings go through a small CSP-safe formatter (plain placeholder
  substitution). vue-i18n never compiles them, so characters such as `{`, `}`, `@`, `$` and `|`
  need no escaping.
- **How a feature uses one**: by its legacy key, written as in the file, `<section>.<key>`, for
  example `edit.max_quota` or `success.mailbox_added` (a few sections nest deeper, such as
  `datatables.paginate.next`). A legacy value is never copied into `src/i18n/messages/`. The
  accessors are UI 001's (research R15): `<LegacyText k="…">` in templates (it also renders values
  with markup and fills DataTables' `_MENU_` with a slot), `lt('…', …args)` where a string is
  needed, `legacy('…')` in tables of text references (`TextRef`), and `LEGACY_TEXTS`
  (`src/i18n/legacy-messages.ts`) for keys built at runtime, such as problem types and enumeration
  values. `LegacyKey` types every key against the bundled snapshot. Plans written before 1.3.0
  that say "map through `src/i18n/legacy-map.json`" or "the legacy layer `src/i18n/legacy/`" mean
  this rule.
- **Text the classic interface hard-codes**: some labels are written into the templates or
  `js/site/*.js` without a key (for example "Keycloak", "IP", "Location", "Pushover API"). They are
  new strings whose English text equals the legacy text. A product name hard-coded there (the fork's
  "FeldHost™ Mailhosting" authentication source option) comes from the branding configuration.
- **Keys only a fork has**: a key missing from the upstream `en-gb` snapshot (for example the
  fork's `diagnostics.allow`) cannot pass `i18n:check` as a legacy key, so it is a new string until
  the orchestrator decides otherwise.

### Forms are one to one

Every screen that has a classic-interface counterpart mirrors that form:

- the same fields, with the same labels, help texts, info texts (the `*_info` keys), placeholders,
  option labels and units;
- the same order and grouping. Legacy tabs, cards and modal groups become sections in the same
  order;
- the same success, warning and danger messages ("Messages" below);
- table column headers, filter labels, empty texts and action labels (edit, remove, activate,
  deactivate, add) from the legacy keys the templates and `data/web/js/site/*.js` use.

The app's design system and layout stay. So do its improvements: sections with their own save,
typed confirmations, bulk mode and outdated-version handling. They use legacy strings wherever an
equivalent exists, for example `mailbox.toggle_all`, `mailbox.remove` or `admin.add`.

**Deviation-free rule.** A screen with a classic-interface counterpart adds, drops, renames,
rewords or reorders nothing relative to that form, except for the improvements above. A field the
API adds is labelled with a legacy key where any legacy form has one. Any other difference (a
legacy field the API does not offer, a legacy field the plan leaves out, a legacy text whose
meaning no longer fits) is listed in the plan under "Deviations needing a decision". It is not
built until the owner or orchestrator decides. It is never silently dropped or reworded.

**Decisions on the deviations found in plans 002–014 (orchestrator, 2026-10-18).** These apply
to every feature. A plan's "Deviations needing a decision" entry that matches one is settled by
it.

- **Follow the legacy form** for structure and controls:
  - quotas in MiB with "0 = ∞", as legacy enters them, replacing UI 002's unit select and
    "Unlimited" switch;
  - durations in legacy's units;
  - **except the domain's "Default mailbox quota"** (`add.mailbox_quota_def`,
    `edit.mailbox_quota_def`, list column `mailbox_defquota`; API `defaultMailboxQuota`). The owner
    calls it an upstream leftover since templates carry the mailbox quota (2026-10-18). It is left
    off the domain create and edit forms, the domain template forms and the domain list. The new
    mailbox form takes its quota from the mailbox template, never from the domain. The API no
    longer has the field at all; it keeps the upstream column valid for the classic interface
    internally. The mailbox form always sends a quota, prefilled from the chosen mailbox template
    and capped at the domain's `usage.maxNewMailboxQuota`. Without one the template chain can give
    0 (unlimited), which the API refuses for a domain administrator without `unlimitedQuota`;
  - the password repeat field wherever legacy has one;
  - legacy's tabs, groups and field order: a legacy tab becomes one section, never several, and
    settings keep legacy's tab structure;
  - legacy's controls: checkboxes, multi-selects, radio and goto options and textareas, as legacy
    has them;
  - no help text, explanation or section heading that legacy lacks.
- **Legacy fields the API lacks** are API gaps, added to the API instead of dropped from the form:
  `mailcow-rest-v2` `docs/api-gaps.md` G39–G42.
- **Screens with no legacy counterpart** (rate-limit overview, MTA-STS overview, DKIM for domain
  administrators, colours, mass-mail jobs) stay. Any field they share with a legacy form uses that
  legacy key, and their remaining texts are new strings.
- **A legacy text whose meaning no longer fits** the new behaviour is replaced by a new string,
  only for that text. Its plan names the legacy key and the reason.
- **Keys only the FeldHost fork has** are new strings until the upstream snapshot has them. On the
  fork, the runtime files still supply the fork's own text.
- **Legacy labels that include their help text** are shown verbatim. The accessible name is the
  visible label.
- **Detail pages** (decided for UI 002, applies to every feature):
  - The title is legacy's edit heading with the object's name. No status badges.
  - Actions that legacy offers only in the list stay only in the list. Deletion is one of them.
  - Display-only panels stay if legacy shows the same data elsewhere, labelled with that screen's
    legacy keys. Examples are usage figures from the list columns and the administrators of a
    domain. A panel with data legacy never shows is a deviation.
  - A field another feature edits is shown read-only in its legacy position until that feature
    lands, then becomes editable there.
- **Outcomes** of creations and changes are shown as legacy shows them: one alert per outcome,
  using the `success.*`, `warning.*` and `danger.*` key legacy returns for it. There is no step
  table. A new string is used only for an outcome legacy cannot report (for example DKIM DNS
  publication).
- **No confirmation legacy lacks**, except the typed and bulk confirmations above. For example,
  choosing a template overwrites the form's fields without asking, as in legacy.
- **The haveibeenpwned check is kept**, as legacy has it (owner, 2026-10-18), on every password
  field that has `data-hibp` in legacy. Those are the mailbox, administrator, domain administrator,
  app password, password change, relayhost and transport forms.
  - It runs only when the user clicks `footer.hibp_check`.
  - The browser computes the password's SHA-1 with Web Crypto and sends only its first five hex
    characters to `https://api.pwnedpasswords.com/range/<prefix>`. It compares the rest locally
    and shows `footer.hibp_ok` or `footer.hibp_nok`.
  - The password never leaves the browser.
  - It is the app's only third-party request. The CSP allows `connect-src
    https://api.pwnedpasswords.com` for it, and nothing else.
  - The first feature that needs it (UI 003) creates the shared `HibpCheck` component under
    `src/shared/components/`, and later features reuse it.
- **Stored OAuth2 client secrets are never shown again** (owner, 2026-10-18). A secret appears
  once, in `OneTimeSecretDialog`, when a client is created or its secret is renewed, singly or in
  bulk. Lists and forms show no secret column or prefilled secret. This deviates from legacy.

### New strings

- New strings exist only for UI elements the classic interface does not have, for example bulk
  result summaries, outdated-version handling, the passkey-first sign-in, one-time secret dialogs,
  the audit log, and "Deviations needing a decision" once they are approved.
- Keep them minimal. Before adding one, search all legacy sections for an equivalent: a key from
  another legacy screen with the same meaning is used as it is.
- They live in `src/i18n/messages/` and are written in English, Czech and Slovak for the owner to
  review. All other languages fall back to English.
- A feature's own strings may live in `src/i18n/messages/<feature>/<locale>.json` instead, so that
  the shell does not bundle them (constitution VII): register the three loaders in
  `featureLoaders` (`src/i18n/index.ts`) and load them with the feature's routes through
  `loadFeatureMessages('<feature>')`, as `src/features/domains/routes.ts` does; language changes
  load them too. `i18n:check` checks them with the app's strings, and component tests load them in
  `tests/setup/vitest.setup.ts`. Strings that other features or shared components use stay in the
  main files, even under the feature's namespace (the shared tag input's `domains.tags.*`, the
  rate limit field's `domains.rateLimit.*`); groups are merged key by key.
- **Never machine-translate**, in any language.
- `i18n:check` fails when a new string is missing in en-gb, cs-cz or sk-sk, or when a legacy key
  the app uses is missing from the bundled `en-gb` snapshot.

### Finding the legacy form

The FeldHost fork checkout is at `../mailhosting` (branch `feldhost-202609a`, upstream tag
`2026-09a`). Paths below are relative to its `data/web/`.

- **Templates** (Twig) in `templates/`:
  - pages: `admin.twig`, `mailbox.twig`, `user.twig`, `dashboard.twig`, `quarantine.twig`,
    `queue.twig`, `domainadmin.twig`, `fido2.twig`, `tfa_keys.twig`, `reset-password.twig`,
    `user_index.twig`, `admin_index.twig`, `domainadmin_index.twig`, `qhandler.twig`;
  - tabs of those pages: `admin/tab-*.twig`, `mailbox/tab-*.twig`, `user/*.twig`;
  - edit pages: `edit/<object>.twig`, reached through `edit.php`;
  - add dialogs and other modals: `modals/{mailbox,admin,user,quarantine,queue,footer}.twig`.

  Texts appear as `{{ lang.<section>.<key> }}`, help texts usually in `<small>` next to the field,
  and `|format(…)` shows what fills a placeholder.
- **Page entry points**: `admin/{dashboard,index,mailbox,queue,system}.php`,
  `domainadmin/{index,mailbox,user}.php`, `user.php`, `edit.php`, `quarantine.php`,
  `reset-password.php`, `qhandler.php`. They choose the template and the data it gets.
- **JavaScript** in `js/site/*.js` (`mailbox.js`, `admin.js`, `user.js`, `dashboard.js`,
  `quarantine.js`, `queue.js`, `edit.js`, `qhandler.js`, `index.js`): DataTables column titles,
  row actions, dynamic labels and alerts. There, `lang.<key>` is the page's own section, bound by
  the page template: `lang_mailbox` on `mailbox.twig`, `lang_admin` on `admin.twig` and
  `dashboard.twig`, `lang_user` on the user and domain administrator pages, `lang_quarantine`,
  `lang_queue`. `lang_footer`, `lang_acl`, `lang_tfa`, `lang_fido2`, `lang_success` and
  `lang_danger` are bound in `inc/footer.inc.php`.
- **PHP** in `inc/`:
  - `functions.*.inc.php` return each outcome as `'type' => 'success' | 'danger' | 'warning'` and
    `'msg' => array('<key>', <arguments>…)`. That names the `success.*`, `danger.*` or `warning.*`
    key and its placeholder arguments. `alertbox_log_parser()` in `functions.inc.php` formats them
    with `vsprintf`;
  - `inc/ajax/*.php` produce dynamic content, for example DNS diagnostics, the transport check and
    sync job logs;
  - `vars.inc.php`, `prerequisites.inc.php` and the `presets/` hold option lists and defaults.
- `docs/legacy-inventory.md` summarises the screens per role.

### The legacy form map

Every plan records a **legacy form map** for its screens, and implementation uses only the keys in
it plus the minimal new strings. The map has three parts:

1. **Fields and elements**: screen (route) → legacy template (and tab or modal) → field or element
   (section heading, label, help or info text, placeholder, option, unit, column header, action,
   empty text) → legacy key. Elements without a legacy key are listed with their new string key and
   the reason.
2. **Messages**: API outcome → legacy key → placeholder sources (next section).
3. **Deviations needing a decision**, if any.

A plan's "Translations and forms (constitution IV 1.3.0)" subsection names the legacy templates
its screens mirror. The full map is written by the feature's first Foundational task, before any
screen is built.

### Messages

The API never localises, so the UI maps each outcome to the legacy message of the same meaning,
from a table in the feature, keyed by operation, problem type and rule code (never by the problem's
`title` or `detail`):

- **Success**: the operation's result maps to the `success.*` key that the matching legacy
  function returns, for example a `201` from creating a mailbox → `success.mailbox_added` with the
  address, a `200` from changing it → `success.mailbox_modified`, a `204` from deleting it →
  `success.mailbox_removed`.
- **Problem types**: `/api/v2/problems/<name>` maps to the `danger.*` key the legacy function
  returns for the same condition, for example a refused duplicate domain → `danger.domain_exists`
  with the domain name. Placeholder arguments come from the request (what the user typed), the
  response, or the problem's extension members (`limit`, `count`, `holder` and so on).
- **Rule codes**: a field error's rule code, read together with its field, maps to the legacy
  `danger.*` key for that field and condition, for example an invalid mailbox local part →
  `danger.mailbox_invalid`, or a quota above the domain's limit → the legacy quota message with the
  limit. The message is shown on the field and in the error summary.
- **Warnings**: partial outcomes (a follow-up step that failed, a value adjusted by the server) map
  to `warning.*` keys where one matches.
- **Bulk results**: each item's line uses the same legacy message as the single action. Only the
  summary line is a new string.
- **No legacy equivalent**: UI 001's generic `problem.*` and `validation.*` new strings apply. A
  feature adds a new string only for an outcome legacy cannot produce, for example an outdated
  version.

## Lists

- List state (search, filters, sort, page, page size) lives in the page address and never in
  browser storage.
- Page sizes are 25 (the default), 50 and 100.
- Lists become cards below the tablet breakpoint and tables on wide screens.
- Every list has loading, empty and error states.

## Bulk actions

- Bulk actions need an explicit selection mode, and the selection covers the current page only.
  It clears when the page, search, filters, sort or page size change.
- The UI sends the API's bulk operation (up to 100 items) together with each item's version tag
  as listed.
- It shows a summary with one result per item. Failed, refused and outdated items stay selected,
  so they can be retried.
- A dropped connection is reported as "outcome unknown" and is never retried automatically.

## Editing and conflicts

- Detail screens are split into sections, each with its own edit and save.
- A save sends only the changed fields, plus the version tag that was read.
- When a save is refused as outdated:
  - the user's input is kept, the object is reloaded and the values that changed are marked, and
    the user saves again;
  - there is no automatic merge and no "overwrite anyway";
  - a refused deletion is confirmed again.

## Confirmations

- Deleting a single object needs a dialog that shows its impact, using the API's delete preview
  where one exists.
- Deleting one domain needs its name typed.
- A bulk deletion needs the number of objects typed.
- Other destructive or high-risk actions (deactivating, stopping a container, mass mail and so
  on) need one explicit confirmation.
- Confirmation dialogs use the texts of legacy's `#ConfirmDeleteModal` (`templates/modals/footer.twig`):
  `footer.confirm_delete` as the title, `footer.delete_these_items` before the affected objects,
  `footer.delete_now` and `footer.cancel` as the buttons, and `footer.restart_container`,
  `footer.restart_container_info` and `footer.restart_now` for container restarts. Only what legacy
  lacks (the impact lines of a delete preview, the typed-confirmation instruction) is a new string.

## Secrets

- A generated secret is shown once, in a dialog with a copy button. This covers API key secrets,
  app passwords, OAuth2 client secrets and one-time sign-in links.
- Closing the dialog without copying asks for confirmation.
- Secrets never go into storage, the page address or browser history.
- Stored secrets are write-only:
  - the field starts empty and says whether a value is stored;
  - leaving it empty keeps the value, and typing replaces it;
  - an explicit action removes it.

## History and audit

- Objects get a **History** action that opens UI 001's audit log screen, filtered to that object
  by target type and target ID. That screen offers these filters.
- Each feature adds labels for its own audit event types to the audit log screen. The audit log
  has no classic-interface counterpart, so these are new strings in en, cs and sk. Unknown event
  types show a generic label.

## Errors and permissions

- API problem types and per-field rule codes are translated in the UI, because the API never
  localises them. Each one is shown with the legacy `danger.*` (or `warning.*`) message of the
  same meaning, and only otherwise with a new string ("Translations and forms", "Messages").
- Field errors are shown on their fields.
- Controls the caller may not use are hidden or shown read-only with the reason. This is a
  convenience only: the API enforces permissions.

## Where features meet

- A later feature adds its entry points into earlier features' screens when it is implemented,
  through each screen's designated action areas. Examples:
  - UI 004 adds the "Send as" link to UI 003's mailbox detail screen;
  - UI 007 adds "Sign in as" and "Open webmail as" to UI 003's lists;
  - UI 009 adds the relayhost sections to UI 002 and UI 003 detail screens;
  - UI 010 adds DKIM, MTA-STS and DNS to UI 002 detail screens.
- Until such a feature ships, the earlier screen shows nothing for it: no placeholder, no broken
  link.
- Capabilities and limits (bulk limits, field limits, enabled server features) come from each API
  feature's capabilities read. The UI never hard-codes them.

## Shared building blocks and canonical names

- **Ownership:** the first UI feature to be implemented that needs a building block creates it under
  `src/shared/` (or the location UI 001 reserves) with its canonical name. Later features import it
  and never create a renamed copy. When two plans name the same thing differently, the name of the
  earlier feature wins:
  - leave guard: `useLeaveGuard` (UI 002). It is not `useUnsavedChangesGuard`;
  - translation coverage registry: the mechanism UI 001 defines, or otherwise UI 002's
    `src/i18n/coverage.json`;
  - bulk bar and selection: UI 002's `BulkActionBar`, `useBulkSelection`, `BulkResultSummary`;
  - confirmations and sections: UI 002's `ConfirmDialog` (with `requireTyped`), `EditableSection`
    and `HistoryLink`;
  - inactivity limit for polling: `useInactivity`, created by UI 008 and reused by UI 011;
  - mailbox search picker: `MailboxSearchPicker`, promoted to `src/shared/components/` at its second
    use;
  - untrusted multi-line text: `neutralise()` (UI 006);
  - downloads: `src/shared/platform/download.ts` (Blob with a revoked object URL, never `data:`
    URLs);
  - route meta flag for routes that resolve in every session state: `meta.public` (UI 005). It is
    not `meta.anySessionState` or `meta.anySession`;
  - mailbox route parameter: `:address` (UI 003 owns the mailbox routes). It is not `:mailbox`;
  - secrets helper: `useSecretRequest` (see below).
- **Bulk limit:** `useBulkSelection` takes the API's bulk limit from the feature's capabilities
  read. "Select all" selects the visible items up to the limit (the first N) and states the limit.
  Once the limit is reached, further selection is disabled with the same message. This applies to
  every list.
- **Action areas in earlier screens:** a later feature adds its entry point to an earlier screen's
  designated action area when it is implemented. Earlier plans' tables of action areas don't need
  to list every later entry.
- **Secrets in requests or responses** (private keys, passwords, generated secrets) never go through
  TanStack Query caches. They go through `useSecretRequest`, a direct client call with loading,
  error and result state, which UI 001 creates for API key creation and UI 005, 010 and 012 reuse.
  Values stay in component state only, and forms carrying secrets never save drafts. Generated
  secrets appear only in `OneTimeSecretDialog`.
- **Polling:** the only automatic polling allowed is a condition-bound `refetchInterval` with
  visibility checks, a pause control and the inactivity limit (the lower of 15 minutes and the
  session idle timeout).
- **Contract pins** only move forward. Each feature checks its own operations against its plan's
  baseline commit.
