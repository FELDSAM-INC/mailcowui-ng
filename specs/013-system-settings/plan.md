# Implementation Plan: System Settings

**Branch**: `main` (no feature branches, constitution 1.1.0) | **Date**: 2026-10-18 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-system-settings/spec.md`

## Summary

UI feature 013 gives administrators one grouped, searchable System settings area with seventeen
pages in seven groups, and adds its entry points to earlier screens. It delivers:

- **the settings area**: an overview with a search over the app's own catalogue (diacritics and case
  ignored, legacy screen names included), a page list beside the open page on wide screens, a page
  switcher on phones, and an address per page;
- **branding**: light and dark logos with previews in both themes before upload, brand colours per
  theme with live WCAG contrast feedback and an accessible adjustment, the UI texts and the
  announcement with a preview through UI 001's sanitiser, the sign-in page options and the app
  links; **the brand colours applied in the whole app** (primary buttons, links, selected navigation
  entry, checked controls);
- **passwords and notifications**: the password policy with its rules as users see them, the
  password reset e-mail and the quota notification e-mail with isolated HTML previews, and the quota
  notification copies on UI 002's domain page;
- **filtering**: Rspamd settings rules with presets, a server Check and the effective settings map;
  the global filter maps with live line marks, a server Check and a review of added and removed
  lines; the global Sieve filters with a Check and an explicit restart choice; the Sieve presets in
  UI 005's create-filter form;
- **mass mail**: compose with a recipient preview and one explicit confirmation naming the count,
  then follow (refreshed every 5 s while watched) and cancel the job, and inspect every recipient;
- **the remaining settings**: Rspamd web interface password, CORS of the classic API, IP check, and
  License where verification is enabled;
- **history**: a History action on every page and entity, with labels and detail formatting for the
  feature's audit events in UI 001's audit log.

The technical approach (details in [research.md](./research.md)):

- **No new runtime dependency** (R3). One feature folder, `src/features/system-settings/`, driven by
  a typed catalogue that feeds the overview, the switcher, the search and History (R4, R5).
- **Editing** follows the conventions: sections with their own Save on UI 002's `EditableSection`,
  merge patches of changed fields only, `If-Match`, and outdated refusals that keep the input and
  mark what changed (R9).
- **Brand colours** become CSS custom properties set through CSSOM on `<html>`, read by semantic
  accent tokens; no inline style is created, and the strict CSP stays as it is (R12). The contrast
  maths is identical to the API's (R13).
- **Editors** are a shared, accessible `<textarea>` editor with a line-number gutter, line marks and
  "go to line" (R17).
- **E-mail HTML previews** run in a sandboxed `iframe` without scripts, with styles applied through
  CSSOM and every remote resource removed (R21).
- **Logo previews** before upload need `img-src 'self' blob:` (R14), the one change to UI 001's CSP.
- **Mass mail progress** is refreshed every 5 s while the job runs, the page is visible, the user
  has not paused it and has interacted within the shared inactivity limit (`min(15 min, idle
  timeout)`, `useInactivity`), so an unattended tab never keeps the session alive (R23, polling rule
  of `docs/conventions.md`).
- **Canonical shared names** of `docs/conventions.md` are used: UI 002's `useLeaveGuard`,
  `ConfirmDialog`, `EditableSection` and `HistoryLink`, UI 006's `PlainText`/`neutralise()`,
  UI 008's `useInactivity` and `MailboxSearchPicker`. The Rspamd password never enters a TanStack
  Query cache (secrets rule, R25).
- **Tests**: unit and component tests first; end-to-end tests of every acceptance scenario on 360 px
  and desktop with axe in both themes, now also with brand colours at the 4.5:1 limit; smoke tests
  against the API dev stack that restore what they change (R30, R31).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) and Vue 3.5 SFCs; Node.js 24 LTS (UI 001).

**Primary Dependencies**: UI 001's ten runtime dependencies (001-R1); none added. DOMPurify (already
present) also serves the e-mail preview. Tooling unchanged.

**Storage**: none on a server. In the browser: the query cache and component state. No new device
storage key (data-model §4); the Rspamd password and mass mail content are never stored.

**Testing**: Vitest and Vue Test Utils (units, components); Playwright `mobile-chromium` (360 ×
780), `desktop-chromium` (1366 × 900) and `mobile-webkit` against the production build with the
production CSP and the contract-validated mock; axe in both themes plus two limit-palette passes;
CSP, horizontal-scroll and touch-target checks; a smoke project against the mailcow-rest-v2 dev
stack (001-R22 to 001-R25).

**Target Platform**: the two latest major versions of evergreen browsers including iOS Safari and
Chrome for Android, served by UI 001's `ng-mailcow` image under `/ng/`.

**Project Type**: web application (static single-page frontend; the backend is mailcow-rest-v2).

**Performance Goals**: SC-014: every settings page usable within 2 s of opening on a mid-range phone
when the API answers within 1 s; search results within 300 ms of a keystroke. SC-009: job progress
at most 10 s behind while watched. Constitution VII budgets unchanged (initial JS ≤ 200 KB gzipped;
Lighthouse performance ≥ 80 and accessibility ≥ 90).

**Constraints**:

- Strict CSP of 001-R18 with the single amendment `img-src 'self' blob:` (R14); no inline script or
  style, no `v-html` outside `SanitizedHtml.vue`.
- WCAG 2.2 AA in both themes, with the default palette and with any brand colour the API accepts.
- 360 px and 400 % zoom without page scroll; only an editor with wrapping off scrolls sideways.
- Only contract operations; limits from the capabilities or the contract, never hard-coded.
- No automatic requests while the user is idle (UI 001 FR-033); the job refresh pauses (R23).
- Constitution IV 1.3.0: every language mailcow ships; legacy texts verbatim by their legacy keys,
  loaded at runtime from the installation; new strings only for elements the classic interface
  lacks, complete in en/cs/sk ("Translations and forms (constitution IV 1.3.0)").

**Scale/Scope**:

- 12 user stories (3 at P1, 6 at P2, 3 at P3).
- 23 routes in one feature folder, plus sections added to UI 002's domain page and UI 005's filter
  form.
- 44 of API 013's 45 operations, plus 7 operations of API 001–003.
- About 120 legacy keys used verbatim (data-model §8, completed by T008a's legacy form map), plus
  the new strings for elements the classic interface lacks (overview, search, colours, mass mail
  jobs, previews, checks). The form map fixes their number, kept to the minimum.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | Only the operations of [contracts/README.md](./contracts/README.md), through the generated client; the pin is bumped with `bump.sh` to a ref containing the baseline commit (R2), and a presence test guards the operations. No hand-written API types (view models only, data-model §2). Problems drive behaviour by `type` and rule `code` (R10). The one gap found (stable mass mail failure codes) is reported to mailcow-rest-v2, and the UI shows only what the contract offers (API gap G1). | PASS |
| II. Mobile-first | Every screen designed and tested at 360 px first; overview as its own screen, page switcher, steps for mass mail below `lg`, sticky Save/Cancel, cards below `md`, 44 px targets including reorder and entry removal, dialogs that scroll inside (R7, R9, R22, R29). Loading, empty and error states for every collection (FR-015). Destructive and high-risk actions confirmed with their impact. | PASS |
| III. Accessibility | axe on every screen and state in both themes, plus limit-palette passes that make every later end-to-end test check brand colours at 4.5:1 (R12). Text equivalents for contrast verdicts, line marks, statuses and progress; throttled announcements; focus to headings and section headings; keyboard-only editors with a documented Tab behaviour (R17, R29). | PASS |
| IV. i18n and branding | Constitution 1.3.0: every mailcow language is offered. The pages mirror the legacy System › Configuration forms, and their page titles, section headings, field labels, help texts, options and messages are mailcow's own translations, used verbatim by legacy key (data-model §8 and T008a's legacy form map), loaded at runtime from the installation, with markup through `SanitizedHtml.vue` and `en-gb` as the fallback; no build-time import, no stripped markup, nothing hand-written for a legacy key (R28). New strings, only for elements the classic interface lacks, exist in en-gb, cs-cz and sk-sk. Operator texts, logos, colours and links come from the API at runtime; the brand colours are now applied (closing 001's Complexity Tracking row). Two English server diagnostics are quoted inside translated messages (Complexity Tracking); the Sieve parser message goes through the legacy `danger.sieve_error` ("Sieve parser error: %s"), as in the classic interface. | PASS (deviation recorded) |
| V. Security in the browser | The CSP stays strict: brand colours through CSSOM, e-mail previews in a script-less sandboxed frame with CSSOM styles and no remote resources, `v-html` only in `SanitizedHtml.vue` (R12, R15, R21). `img-src` gains `blob:` for pre-upload logo previews, which adds no inline script or style (R14). The Rspamd password is write-only, sent by a direct client call that bypasses every TanStack Query cache, kept only in component state and cleared after every attempt (R25, secrets rule of the conventions); mass mail content stays in memory (FR-108). Hiding is a convenience: the API enforces roles; 401, 403 and 404 are handled. | PASS |
| VI. Test-first | `tasks.md` puts mocks and tests before implementation in every phase; end-to-end tests of every acceptance scenario on both viewports against a contract-validated mock; smoke tests against the real API (R30, R31). | PASS |
| VII. Performance budgets | Lazy chunks for every page, the editor and the preview; the entry chunk grows by about 2 KB (R32). Queries follow 001-R9; the single periodic refresh (running job) is the condition-bound exception the conventions allow: it pauses when hidden, on request, and after the shared inactivity limit (R23, Complexity Tracking). | PASS (deviation recorded) |
| VIII. Simplicity | No new dependency; textarea editor instead of CodeMirror; multiset diff; one feature folder; shared blocks only with two uses (code editor, e-mail preview, contrast maths, entry lists), each justified (R3, R17, R18, R26). | PASS |
| Technology constraints | Stack unchanged; Reka parts without viewports (pickers, dialogs); no CDN, no SSR, no backend code. | PASS |
| Workflow and gates | Every CI gate of 001-R28 applies; Lighthouse gains a settings URL (R32). Commits to `main`. GPL-3.0 compatibility unchanged (no new dependency). | PASS |
| `docs/conventions.md` | Wording ("the classic interface"); lists in the address with 25/50/100 and cards/tables (one documented exception, Complexity Tracking); sections with own Save and outdated handling; confirmations (one explicit confirmation for mass mail); write-only secret (Rspamd password); History by target type and ID with this feature's labels; problems and rule codes translated, through the legacy `danger.*` messages where the meaning matches; capabilities and limits from the API; entry points added through earlier screens' section areas. | PASS (deviation recorded) |

**Post-design re-check (after Phase 1)**: PASS. The data model, contracts README and quickstart add
no violation. Decisions that touched gates:

- `img-src 'self' blob:` for logo previews instead of a canvas-only preview that cannot show SVG or
  animation: V (R14).
- Sandboxed `iframe` without `src`, CSSOM-applied styles and no remote resources, instead of a
  second document with `style-src 'unsafe-inline'`: V (R21).
- Attended job refresh: VII and UI 001 FR-033 (R23).
- Textarea editor instead of CodeMirror 6: VIII (R17).

## Translations and forms (constitution IV 1.3.0)

The owner rule of 2026-10-18 (`docs/conventions.md`, "Translations and forms") applies to every
screen of this feature. It overrides any earlier text in this plan, the spec, research and tasks.
The operator's UI texts (page title, product name, help text, footer, announcement, app link names)
are API data shown as stored; the rule covers the labels and messages around them.

**Legacy forms mirrored** (paths under `../mailhosting/data/web/`; page entry `admin/system.php`):

- **Settings area** (overview, page list, switcher) → `templates/admin.twig`: the menus Access
  (`admin.access`), Options (`admin.options`) and Global filter maps (`admin.rspamd_global_filters`)
  and the System mails tab (`admin.sys_mails`); the menu entries name the pages.
- **Logos** → `templates/admin/tab-config-customize.twig`, "Change logo" card (`admin.change_logo`,
  `admin.logo_normal_label`, `admin.logo_dark_label`, `admin.upload`, `admin.reset_default`,
  `admin.logo_info`) and `templates/admin/customize/logo.twig`. Messages:
  `inc/functions.customize.inc.php` (`success.upload_success`, `success.reset_main_logo`,
  `danger.img_invalid`, `danger.invalid_mime_type`, `danger.img_size_exceeded`,
  `danger.img_dimensions_exceeded`, `danger.demo_mode_enabled`).
- **UI texts** → the same template, UI texts card (`admin.ui_texts`, `admin.title_name`,
  `admin.main_name`, `admin.apps_name` with the placeholder `header.apps`, `admin.help_text`,
  `admin.ui_footer`, `admin.ui_header_announcement`, `admin.ui_header_announcement_select`,
  `admin.ui_header_announcement_type_*`, `admin.ui_header_announcement_content`,
  `admin.ui_header_announcement_active`, `admin.ui_header_announcement_help`); `success.ui_texts`.
- **Sign-in page** → the Login page card (`admin.login_page`, `admin.quicklink_text`,
  `admin.user_quicklink`, `admin.domainadmin_quicklink`, `admin.admin_quicklink`, `admin.force_sso`,
  `admin.force_sso_text`); `success.custom_login_modified`.
- **App links** → the App links card (`admin.app_links`, `admin.app_name`, `admin.link`,
  `admin.user_link`, `admin.app_hide`, `admin.add_row`, `admin.remove_row`,
  `admin.merged_vars_hint`) and its rows in `js/site/admin.js`; `success.app_links`.
- **IP check** → the IP check card (`admin.ip_check`, `admin.ip_check_opt_in`);
  `success.ip_check_opt_in_modified`.
- **Password policy and password reset e-mail** →
  `templates/admin/tab-config-password-settings.twig` (`admin.password_settings`,
  `admin.password_policy`, `admin.password_length`, the `admin.password_policy_*` options,
  `admin.password_reset_settings`, `admin.quota_notification_sender`,
  `admin.quota_notification_subject`, `admin.password_reset_tmpl_text`,
  `admin.password_reset_tmpl_html`, `admin.reset_password_vars`, `admin.restore_template`).
  Messages: `password_complexity()` and `reset_password()` in `inc/functions.inc.php`
  (`success.password_policy_saved`).
- **Quota notifications** → `templates/admin/tab-config-quota.twig` (`admin.quota_notifications`,
  `admin.quota_notifications_info`, `admin.quota_notification_sender`,
  `admin.quota_notification_subject`, `admin.quarantine_notification_html`,
  `admin.quota_notifications_vars`); `inc/functions.quota_notification.inc.php`
  (`success.saved_settings`, `danger.goto_invalid`). **Quota warning BCC** on UI 002's domain page →
  `templates/edit/domain.twig`, tab `dqwbcc` (`edit.quota_warning_bcc`,
  `edit.quota_warning_bcc_info`, `edit.target_address`, `edit.active`).
- **Rspamd settings rules** → `templates/admin/tab-config-rsettings.twig`
  (`admin.rspamd_settings_map`, `admin.active_rspamd_settings_map`, `admin.rsetting_none`,
  `admin.rsetting_no_selection`, `admin.rsetting_desc`, `admin.rsetting_content`, `admin.active`,
  `admin.save`, `admin.remove`, `admin.rsetting_add_rule`) and `templates/modals/admin.twig`
  `addRsettingModal` (`admin.add_settings_rule`, `admin.rspamd_com_settings` with the Rspamd
  documentation link, presets from `js/presets/rspamd.js` with `admin.rsettings_preset_<n>`).
  Messages: `rsettings()` in `inc/functions.rspamd.inc.php` (`success.settings_map_added`,
  `success.object_modified`, `success.settings_map_removed`, `danger.settings_map_invalid`,
  `danger.map_content_empty`).
- **Global filter maps** → `templates/admin/tab-globalfilter-regex.twig`
  (`admin.rspamd_global_filters`, `admin.regex_maps`, `admin.rspamd_global_filters_info`,
  `admin.rspamd_global_filters_regex`, `admin.rspamd_global_filters_agree`, `add.validate`,
  `edit.save`) and `js/site/admin.js`. Messages: `inc/functions.rspamd.inc.php`
  (`success.object_modified`, `danger.global_map_invalid`, `danger.global_map_write_error`).
- **Rspamd web interface** → `templates/admin/tab-config-rspamd.twig` (`admin.password`,
  `admin.password_repeat`, `admin.save`; the "Rspamd UI" heading is hard-coded). Messages:
  `rspamd_ui()` in `inc/functions.inc.php` (`success.rspamd_ui_pw_set`, `danger.password_empty`,
  `danger.password_mismatch`, `danger.rspamd_ui_pw_length`).
- **Global Sieve filters** → `templates/mailbox/tab-filters.twig` (the hard-coded "Global
  Prefilter" and "Global Postfilter" headings, `add.validate`, `admin.save`) and
  `js/site/mailbox.js`. Messages: `inc/functions.mailbox.inc.php` (`success.global_filter_written`,
  `danger.global_filter_write_error`, `danger.sieve_error`, `success.dovecot_restart_success`,
  `warning.dovecot_restart_failed`).
- **Sieve presets** in UI 005's create-filter form → `templates/modals/mailbox.twig`
  (`mailbox.sieve_preset_header`) and `js/presets/sieveMailbox.js` (`mailbox.sieve_preset_<n>`).
- **CORS** → `templates/admin/tab-config-admins.twig`, CORS card (`admin.cors_settings`,
  `admin.allowed_origins`, `admin.allowed_methods`, `admin.save`). Messages: `cors()` in
  `inc/functions.inc.php` (`success.cors_headers_edited`, `danger.cors_invalid_origin`,
  `danger.cors_invalid_method`).
- **License** → upstream `templates/dashboard.twig` at `2026-09a`, GUID & License card
  (`admin.guid_and_license`, `admin.guid`, `admin.customer_id`, `admin.service_id`,
  `admin.validate_license_now`, `admin.license_info`); removed in the FeldHost fork. `license()` in
  `inc/functions.inc.php`.
- **Send mass mail** → `templates/admin/tab-sys-mails.twig` (`admin.sys_mails`, `admin.from`,
  `admin.subject`, `admin.include_exclude`, `admin.include_exclude_info`, `admin.includes`,
  `admin.excludes`, `admin.text`, `admin.html`, `admin.optional`, `admin.activate_send`,
  `admin.send`). Messages: `sys_mail()` in `inc/functions.inc.php` (`danger.from_invalid`,
  `danger.subject_empty`, `danger.text_empty`; its completion and mailer messages are hard-coded
  English).

**Screens or elements without a legacy counterpart** use new strings (en-gb, cs-cz, sk-sk, never
machine-translated), kept minimal: the overview's group names and page descriptions, the search,
the Colours page, the empty-value meanings (FR-016), the logo previews, the HTML previews and their
removed-content notes, the line marks, server checks and change review of the editors, the restart
choice of the global Sieve filters, the recipient preview and confirmation, the mass mail jobs
pages, the quota copies pointer, the CORS scope note, confirmations, bulk summaries, outdated-version
handling and the audit log labels. The literal legacy names "Rspamd UI", "Prefilter" and "Postfilter",
which legacy hard-codes, are new strings with the same text.

**Deviation-free rule**: these screens add, drop, rename, reword or reorder nothing relative to the
legacy forms above, except the conventions' improvements (sections with their own save, typed
confirmations, bulk mode, outdated-version handling). Page titles, section headings (the legacy card
titles), labels, help and info texts (`*_info`, `*_vars`, `admin.logo_info`,
`admin.ip_check_opt_in`, `admin.rspamd_com_settings`), placeholders, option labels, units, order
and grouping, column headers, action labels and success, warning and danger messages come from the
legacy keys. Every mailcow language is supported; legacy values are loaded at runtime from the
installation and shown verbatim (markup through `SanitizedHtml.vue`, product names as the
installation's files have them, for example `admin.main_name`); a missing key falls back to
`en-gb`, never to a hand-written value.

### Legacy form map (T008a, implementation audit 2026-10-20)

Sources are the checked-out FeldHost templates under `../mailhosting/data/web/` listed above,
plus the upstream bundled `en-gb` snapshot for the removed License card. Rows retain source order
within each form; API names describe the binding, not replacement labels. API-only controls use
new strings only after the corresponding deviation is resolved. Shared edit/cancel/conflict and
History actions use the existing shared components.

| Screen / legacy template | Ordered field, grouping or action → legacy key | Help, placeholders and outcomes |
|---|---|---|
| Area / `admin.twig` | Existing menu names `admin.access`, `admin.options`, `admin.rspamd_global_filters`, `admin.sys_mails`; new seven-group overview under D1 | Page titles below retain the card/menu wording. Search and descriptions have no legacy counterpart. |
| Logos / `admin/tab-config-customize.twig`, `admin/customize/logo.twig` | Title `admin.change_logo`; light file → `admin.logo_normal_label`; dark file → `admin.logo_dark_label`; upload → `admin.upload`; reset → `admin.reset_default` | `admin.logo_info`; `success.upload_success`, `success.reset_main_logo`; `danger.img_invalid`, `danger.invalid_mime_type`, `danger.img_size_exceeded`, `danger.img_dimensions_exceeded`, `danger.demo_mode_enabled`. File type/size/dimensions come from capabilities. |
| IP check / `admin/tab-config-customize.twig:40` | Title `admin.ip_check`; `enabled` checkbox → `admin.ip_check_opt_in`; save → `admin.save` | Checkbox label contains the full legacy explanation and `<strong>` markup; render with `LegacyText` inside its label. `success.ip_check_opt_in_modified`; `danger.demo_mode_enabled`. Default unchecked. Dashboard link is the existing UI011 entry label. |
| Sign-in page / same, Login page card | Title `admin.login_page`; hide mailbox link → `admin.user_quicklink`; hide domain administrator link → `admin.domainadmin_quicklink`; hide administrator link → `admin.admin_quicklink`; force SSO → `admin.force_sso`; save → `admin.save` | `admin.quicklink_text` precedes the three hide checkboxes; `admin.force_sso_text` precedes force SSO; both retain markup. `success.custom_login_modified`, `danger.demo_mode_enabled`. |
| App links / same, App links card | Title `admin.app_links`; row columns name → `admin.app_name`, URL → `admin.link`, user URL → `admin.user_link`, hidden → `admin.app_hide`; row removal → `admin.remove_row`; save → `admin.save`; append → `admin.add_row` | `admin.merged_vars_hint` above rows; built-in rows keep the same fields read-only. `success.app_links`, `danger.demo_mode_enabled`. Reordering is an added accessible control with new text. |
| UI texts / same, UI texts card | Title `admin.ui_texts`; title → `admin.title_name`; product → `admin.main_name`; apps heading → `admin.apps_name`; help → `admin.help_text`; announcement type → `admin.ui_header_announcement`; announcement text; active → `admin.ui_header_announcement_active`; footer → `admin.ui_footer`; save → `admin.save` | Apps placeholder `header.apps`; title/product placeholders await D5 (no hard-coded brand). Announcement help `admin.ui_header_announcement_help`, selection prompt `admin.ui_header_announcement_select`, options `admin.ui_header_announcement_type_info`, `admin.ui_header_announcement_type_warning`, `admin.ui_header_announcement_type_danger`. Text label awaits D4. `success.ui_texts`, `danger.demo_mode_enabled`. Footer remains after announcement, as the source. |
| Colours / no legacy form | New page and light/dark fields, previews, contrast results, suggested adjustments | D2 unresolved: no implementation until decision; no legacy strings invented. |
| Password policy / `admin/tab-config-password-settings.twig` | Group `admin.password_settings`; title `admin.password_policy`; length → `admin.password_length`; class checkboxes in stored legacy order → `admin.password_policy_chars`, `admin.password_policy_special_chars`, `admin.password_policy_lowerupper`, `admin.password_policy_numbers`; save → `admin.save` | Rules reuse `admin.password_policy_length` with `%d`; `success.password_policy_saved`. Limits from capabilities; defaults length 6, all classes off. |
| Password reset email / same | Title `admin.password_reset_settings`; sender → `admin.quota_notification_sender`; subject → `admin.quota_notification_subject`; text template → `admin.password_reset_tmpl_text`; HTML template → `admin.password_reset_tmpl_html`; restore each → `admin.restore_template`; save → `user.save_changes` | `admin.reset_password_vars` above fields, preserving placeholders and markup. Default sender/subject empty; defaults identified by API. Availability, preview and changed-template notices are new UI elements. |
| Quota notifications / `admin/tab-config-quota.twig` | Title `admin.quota_notifications`; sender → `admin.quota_notification_sender`; subject → `admin.quota_notification_subject`; HTML template → `admin.quarantine_notification_html`; save → `user.save_changes` | `admin.quota_notifications_info`; exact source placeholders `quota-warning@localhost`, `Quota warning`. `admin.quota_notifications_vars` is commented out in source, not an active help text. `success.saved_settings`, `danger.goto_invalid`. |
| Quota copies / `edit/domain.twig`, dqwbcc | Tab `edit.quota_warning_bcc`; recipients textarea → `edit.target_address`; enabled → `edit.active`; save → `edit.save` | `edit.quota_warning_bcc_info`; keep textarea until D10; `success.domain_modified`, `danger.goto_invalid`. |
| Rspamd rules / `admin/tab-config-rsettings.twig` | Title `admin.rspamd_settings_map`; effective map → `admin.active_rspamd_settings_map`; empty → `admin.rsetting_none`; no selection → `admin.rsetting_no_selection`; add action → `admin.rsetting_add_rule`; description → `admin.rsetting_desc`; content → `admin.rsetting_content`; active → `admin.active`; save → `admin.save`; delete → `admin.remove` | `success.settings_map_added`, `success.object_modified`, `success.settings_map_removed`; `danger.settings_map_invalid`, `danger.map_content_empty`. Effective content remains read-only. |
| Create Rspamd rule / `modals/admin.twig`, addRsettingModal | Title `admin.add_settings_rule`; same description/content/active order and keys as edit; presets → `admin.rsettings_preset_1` etc. from `js/presets/rspamd.js` | `admin.rspamd_com_settings` retains documentation link and markup. Preset titles are looked up using their API translation key, never copied. |
| Filter maps / `admin/tab-globalfilter-regex.twig` | Title `admin.rspamd_global_filters`; consent → `admin.rspamd_global_filters_agree`; maps heading → `admin.regex_maps`; API map description/name labels; validate → `add.validate`; save → `edit.save` | `admin.rspamd_global_filters_info`, `admin.rspamd_global_filters_regex`; retain consent/validate-before-save until D7. Restart link handling awaits D7. `success.object_modified`, `danger.global_map_invalid`, `danger.global_map_write_error`. |
| Rspamd web interface / `admin/tab-config-rspamd.twig` | Literal title “Rspamd UI” has no key; password → `admin.password`; repeat → `admin.password_repeat`; save → `admin.save` | Both password fields retained until D8. `success.rspamd_ui_pw_set`, `danger.password_empty`, `danger.password_mismatch`, `danger.rspamd_ui_pw_length`. No secret cache or draft. |
| Global Sieve / `mailbox/tab-filters.twig` | Literal headings “Global Prefilter”, “Global Postfilter”; script textarea in each; validate → `add.validate`; save → `admin.save` | `success.global_filter_written`, `danger.global_filter_write_error`, `danger.sieve_error`, `success.dovecot_restart_success`, `warning.dovecot_restart_failed`. Restart choice awaits D11. |
| Sieve presets / `modals/mailbox.twig`, `js/presets/sieveMailbox.js` | Header `mailbox.sieve_preset_header`; headlines `mailbox.sieve_preset_1` etc. | Insert example is added to UI005's existing form through its public entry point; no independent filter form. |
| CORS / `admin/tab-config-admins.twig` | Title `admin.cors_settings`; origins textarea → `admin.allowed_origins`; methods multiple-select → `admin.allowed_methods`, source option order POST, GET, DELETE, PUT; save → `admin.save` | Literal HTTP method names are protocol data. Keep legacy controls until D9. `success.cors_headers_edited`, `danger.cors_invalid_origin`, `danger.cors_invalid_method`. API-v1 scope explanation is new. |
| License / upstream `dashboard.twig` | Title `admin.guid_and_license`; GUID → `admin.guid`; customer → `admin.customer_id`; service → `admin.service_id`; verify → `admin.validate_license_now` | `admin.license_info` contains vendor links; keep verbatim until D6. Result/support/last verification are API-only states with new strings. Disabled feature makes the page unavailable. |
| Mass mail / `admin/tab-sys-mails.twig` | Title `admin.sys_mails`; sender → `admin.from`; subject → `admin.subject`; include/exclude group → `admin.include_exclude`; include → `admin.includes`; exclude → `admin.excludes`; plain body → `admin.text`; HTML body → `admin.html` plus `admin.optional`; activation checkbox → `admin.activate_send`; send → `admin.send` | `admin.include_exclude_info`; `danger.from_invalid`, `danger.subject_empty`, `danger.text_empty`. Selection/preview/job deviations await D3; hard-coded classic completion messages do not become invented legacy keys. |

Implementation order: the first independent slice covers the capabilities boundary and IP check,
which uses the delivered shared section and conflict primitives. The remaining phase-2 editor,
preview, contrast and multi-entry foundations stay open until a screen needs them; this does not
claim those prerequisites or any later story complete. Only registered pages receive links.


**Deviations needing a decision** (not built until the owner or orchestrator decides; until then the
legacy form applies):

1. **Structure of the settings area — approved by the orchestrator, 2026-10-20.** FR-004, data-model §10, research R5 and tasks T035/T038/T039 explicitly require the seven groups and seventeen pages. This approval covers grouping, not the unresolved form deviations below. (FR-004 to FR-008): legacy spreads the pages over the Access,
   Options and Global filter maps menus and the System mails tab, and keeps Change logo, IP check,
   Login page, App links and UI texts as cards of one Customize tab. The plan regroups them into
   seven new groups and seventeen pages with descriptions and a search. Page titles use the legacy
   card and menu keys; the groups, descriptions and search are new strings.
2. **Colours page** (FR-024 to FR-031): no legacy counterpart (a new capability of API 013).
3. **Mass mail jobs** (FR-087 to FR-089) and the recipient preview: no legacy counterpart; legacy
   sends synchronously. Legacy's include/exclude multi-selects (`admin.includes`, `admin.excludes`,
   `admin.include_exclude_info`) become a domain limit, an include-or-exclude choice and searchable
   pickers, and the "Activate send button" checkbox (`admin.activate_send`) becomes a confirmation of
   the count. The "Convert HTML to plain text" link (`admin.convert_html_to_text`) is dropped
   (earlier orchestrator decision).
4. **Announcement text label** (FR-034): legacy's `admin.ui_header_announcement_content` says
   "Text (HTML allowed)", but legacy shows the text escaped, and the plan treats it as plain text.
   Verbatim, the label contradicts the behaviour.
5. **UI texts placeholders**: legacy hard-codes the brand ("FeldHost™ Mailhosting UI" in the fork,
   "mailcow UI" upstream) as the placeholder of the title and product name fields. The app cannot
   hard-code a brand (constitution IV); the apps heading keeps its legacy placeholder `header.apps`.
6. **License vendor links** (FR-077): `admin.license_info` contains links to the vendor's order
   pages, which an earlier orchestrator decision drops. Verbatim through the sanitiser, the links
   would stay.
7. **Global filter maps explanation** (FR-063): `admin.rspamd_global_filters_regex` contains a
   "restart Rspamd" link that opens a legacy modal; the app has no restart on this page (UI 011).
   The "I will be careful!" gate (`admin.rspamd_global_filters_agree`) is replaced by the change
   review, and the legacy Validate-then-Save flow (`add.validate`) by live line marks and a server
   check.
8. **Rspamd web interface password** (FR-073): legacy asks for the password twice (`admin.password`,
   `admin.password_repeat`); the plan has one field with show and hide.
9. **CORS** (FR-075): legacy has an origins text area and a methods multi-select; the plan has a
   list of entries and checkboxes, plus a scope note (new string).
10. **Quota warning BCC** (FR-052): legacy has one recipients text area (`edit.target_address`); the
    plan has a list of entries.
11. **Global Sieve filters restart choice** (FR-070): legacy restarts Dovecot on every save; the plan
    adds an explicit choice (new strings).

## API dependency and gaps

This feature depends on **mailcow-rest-v2 feature 013** (its contract, merged), on the identity,
public configuration, errors and audit log of API 001, on the domain list and audit target filters
of API 002, and on the password policy read and mailbox list of API 003. The planning baseline is
commit `32079252d55797d3da4e58ae661e9fb91c51c6f9` (see [contracts/README.md](./contracts/README.md)).
Every behaviour of the spec's "API Dependency" table is in the contract: the settings capabilities
read (logo limits, license switch, demo mode, host name, Rspamd address, colour references, field
limits), the preview search, the validate-only option and the brand colours in the public
configuration.

**Gap**:

- **G1. Mass mail recipient failure reasons are free text.** US10-AS6 and FR-088 ask for "the
  translated reason" of each failed recipient. `MassMailRecipient.failureReason` carries Dovecot's
  English reply, the token `interrupted`, or a connection error, with no stable code.
  - **Proposed to mailcow-rest-v2**: add `failureCode` (for example `overQuota`,
    `mailboxUnavailable`, `rejected`, `temporaryFailurePersisted`, `interrupted`,
    `connectionFailed`) next to `failureReason`, and list it in `docs/problems.md`.
  - **Until then**: `interrupted` gets its own translated text; any other failure shows the
    translated "Delivery failed" with the mail server's reply quoted verbatim (R10, R24). This shows
    what the contract offers and does not guess codes, so it is not a workaround. The spec records
    it as a plan-level clarification (FR-088, US10 AS-6). T040 specifies the gap in mailcow-rest-v2
    before US10 starts. Not blocking.

**Observations** (no change needed for 013):

- **O1. Large list payloads**: `listRspamdRegexMaps` returns every map's content (up to 13 × 1 MiB),
  and `listMassMailJobs` every job's bodies (up to 2 MiB each). A list without content would keep
  the list pages light on phones. 013 seeds the map pages from the list to avoid a second download.
- **O2. Free-text diagnostics**: `sieveSyntax.message` and `DovecotRestartOutcome.detail` are English
  by design. 013 quotes the parser message (FR-069 requires it) and does not show the detail.
- **O3. Component naming**: the bundler hoists `AuditTarget.type` into a component named `type`, so
  the generated root type is `Type`. Naming the enumeration `AuditTargetType` in `api/components`
  would give clients a clear name. 013 aliases it in `src/api/index.ts`.

## Foundation amendments

013 changes these artefacts of earlier features, each through a task:

| Artefact | Change | Reason |
|---|---|---|
| `docker/nginx/security-headers.conf` (001-R18) | `img-src 'self' blob:` | pre-upload logo previews (R14) |
| `src/styles/main.css` (001-R16) | semantic accent tokens with runtime overrides; link style on the tokens | FR-030 (R12) |
| `src/shared/ui/button`, `switch`, `checkbox`, `radio-group`; `src/app/shell/NavigationList.vue` | accent tokens; solid selected navigation pill | FR-030 (R12) |
| `src/app/branding/` | `brand-colors.ts` (new), `logo-sizes.ts` (new); `BrandLogo.vue` gains `size` and `src` | FR-019, FR-030, FR-031 |
| `src/app/router/focus.ts` (001-R19) | focus the hash target heading | FR-007 (R6) |
| `src/shared/security/sanitize.ts` (001-R17) | `sanitizeHtmlWithReport()` beside `sanitizeHtml()` | FR-036 (R15) |
| `src/api/query/keys.ts`, `src/api/index.ts` | 013 key roots; `AuditTargetType` alias | data-model §3 |
| 001-R9 query policy | one condition-bound `refetchInterval` (running mass mail job) with the shared `useInactivity` limit, as `docs/conventions.md` allows | FR-088 (R23) |
| `tests/e2e/fixtures/a11y.ts` (001-R24) | two limit-palette passes | SC-003, SC-004 (R12) |
| `tests/mocks/contract/validator.ts` (001-R22) | binary request bodies | `replaceLogo` (R30) |
| UI 001's legacy translation layer (formatter) | `%d` substituted like `%s`, if UI 001 does not yet do it; no build-time import and no stripped markup (constitution IV 1.3.0) | FR-103 (R28) |
| `scripts/run-lhci.mjs` (001-R26) | a `/ng/system/ui-texts` collection | VII (R32) |
| `src/features/audit-log/` (UI 001) | labels and detail formatters for 013's events and targets | FR-091 (R27) |
| UI 002's tag editor | `validateEntry`, `normalise`, `max`, `splitPattern` | FR-052, FR-075 (R26) |
| `MailboxSearchPicker` (UI 006, promoted by UI 008) | multi-select chips; `status` and `domain` filters | FR-081 (R22) |
| UI 002's domain page | `QuotaCopiesSection` in its section area | FR-051 (R27) |
| UI 005's create-filter form; its script editor | "Insert example" (`PresetPicker`); the script field moves onto the shared `CodeEditor` | FR-062 (R17, R19) |

## Owner-level questions (defaults applied)

1. **CSP for logo previews.** **Default**: `img-src 'self' blob:` (R14). The alternative, a canvas
   preview, cannot show SVG logos before upload and loses GIF animation, so FR-020's preview would
   apply to raster files only.
2. **Link to the Rspamd documentation.** FR-055 requires a link to the Rspamd documentation of the
   settings structure, while the spec drops the licence vendor links and the HTML-to-text converter
   as third-party links. **Default**: keep the documentation link. Under constitution IV 1.3.0 it is
   part of the legacy text `admin.rspamd_com_settings`, shown verbatim.
3. **Native review of new Czech and Slovak strings** (constitution IV 1.3.0). **Default**: the owner
   reviews the new cs-cz and sk-sk strings of this feature before release; legacy keys are never
   translated by hand. `i18n:check` guarantees completeness, not wording.

## Parity notes added by the plan

1. A filter map that the API lists with `available: false` shows a notice and a read-only editor
   before any save is attempted (improves on FR-067, which reports it after saving).
2. The force-single-sign-on note uses `externalIdentityProvider.singleSignOnAvailable`: the option
   has no effect while single sign-on is unavailable, also when an LDAP provider is configured.
3. The e-mail HTML preview replaces every image, including inline `data:` images, by a labelled
   placeholder.
4. The editors do not capture Tab, as the legacy text areas do not; indentation uses spaces.

## Project Structure

### Documentation (this feature)

```text
specs/013-system-settings/
├── spec.md              # Feature specification (with clarifications and parity)
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R32
├── data-model.md        # Phase 1: consumed API data, view models, cache, state machines, routes, catalogue
├── quickstart.md        # Phase 1: validation guide
├── contracts/README.md  # Phase 1: pinned contract, operations, problems and rule codes
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

New files of this feature, inside UI 001's layout; files of earlier features that 013 extends are
marked *(extends)*.

```text
docker/nginx/security-headers.conf                     # (extends 001) img-src 'self' blob:
scripts/run-lhci.mjs                                   # (extends 001) settings collection
src/
├── api/
│   ├── index.ts                                       # (extends) AuditTargetType alias
│   └── query/keys.ts                                  # (extends) 013 roots
├── app/
│   ├── branding/{brand-colors.ts,logo-sizes.ts}       # new
│   ├── shell/{BrandLogo.vue,NavigationList.vue}       # (extends 001)
│   ├── navigation/catalogue.ts                        # (extends 001) system → available
│   └── router/{routes.ts,focus.ts}                    # (extends 001)
├── features/
│   ├── system-settings/
│   │   ├── index.ts  routes.ts  catalogue.ts  search.ts
│   │   ├── api/{capabilities,branding,passwords,notifications,rspamd,global-filters,presets,
│   │   │        cors,license,mass-mail}.ts
│   │   ├── composables/{useSettingsSection,useLogoCandidate,useMassMailCompose,
│   │   │                useJobRefresh}.ts   # leave guard: UI 002's useLeaveGuard
│   │   ├── lib/{logo-file,regex-lines,line-diff,origin,app-link-url,email-samples,selection,
│   │   │        preset-key}.ts
│   │   ├── layouts/{SettingsLayout,SettingsNav,PageSwitcher}.vue
│   │   ├── components/
│   │   │   ├── common/{SettingsPageHeader,SettingsSection,ReadOnlyNotice,DefaultBadge,
│   │   │   │           SettingsNotFoundState,StatusMessage}.vue
│   │   │   ├── branding/{LogoCard,LogoPreview,LogoUploadPanel,ColourField,ContrastReport,
│   │   │   │             BrandPreview,HtmlFieldPreview,AppLinkList,AppLinkEntryForm,
│   │   │   │             BuiltInAppLinks}.vue
│   │   │   ├── passwords/{PolicyRulesPreview,PlaceholderReference,TemplateField}.vue
│   │   │   ├── notifications/QuotaCopiesSection.vue
│   │   │   ├── spam/{RuleList,RuleCard,RuleTable,RuleFilters,RuleForm,PresetPicker,
│   │   │   │         CheckResult,MapList,MapChangeReview,RegexFormatHelp}.vue
│   │   │   ├── mail-filtering/{GlobalSieveFilterForm,RestartChoiceDialog}.vue
│   │   │   ├── integrations/{MethodCheckboxes,LicenseResult}.vue
│   │   │   └── mass-mail/{ComposeSteps,RecipientSelection,DomainPicker,
│   │   │                  RecipientPreview,SendConfirmDialog,JobList,JobCard,JobTable,
│   │   │                  RunningJobBanner,JobProgress,JobRecipients,JobBodies}.vue
│   │   └── pages/
│   │       ├── SettingsOverviewPage.vue
│   │       ├── branding/{LogosPage,ColoursPage,UiTextsPage,SignInPageSettingsPage,AppLinksPage}.vue
│   │       ├── passwords/{PasswordPolicyPage,PasswordResetEmailPage}.vue
│   │       ├── notifications/QuotaNotificationsPage.vue
│   │       ├── spam/{RspamdRulesPage,RspamdRuleCreatePage,RspamdRuleDetailPage,
│   │       │         EffectiveSettingsMapPage,FilterMapsPage,FilterMapPage,RspamdWebInterfacePage}.vue
│   │       ├── mail-filtering/GlobalSieveFiltersPage.vue
│   │       ├── integrations/{CorsPage,IpCheckPage,LicensePage}.vue
│   │       └── mass-mail/{MassMailSendPage,MassMailJobsPage,MassMailJobPage}.vue
│   ├── audit-log/{labels.ts,details/system-settings.ts,components/AuditEventDetails.vue}  # (extends 001)
│   ├── domains/pages/DomainDetailPage.vue             # (extends UI 002; path as delivered)
│   └── sieve-filters/components/SieveFilterForm.vue   # (extends UI 005; path as delivered)
├── shared/
│   ├── color/contrast.ts                              # new (app branding + Colours page)
│   ├── components/code-editor/{CodeEditor.vue,line-layout.ts,byte-length.ts}   # new
│   ├── components/{EmailHtmlPreview,EmailPreviewDialog}.vue                     # new
│   ├── components/TagEditor.vue                       # (extends UI 002/003)
│   ├── components/MailboxSearchPicker.vue             # (extends UI 006/008) multi-select, filters
│   ├── security/{sanitize.ts,email-html.ts}           # (extends 001) + new
│   ├── ui/{button,switch,checkbox,radio-group}/       # (extends 001) accent tokens
│   └── validation/{email.ts,entry-list.ts,limits.ts}  # new / (extends 001)
├── i18n/messages/*.json                               # (extends) new strings only
└── styles/main.css                                    # (extends 001) accent tokens
tests/
├── unit/                                              # mirrors src/ for the files above
├── mocks/
│   ├── contract/validator.ts                          # (extends 001) binary bodies
│   ├── handlers/{settings-server,settings-branding,settings-password,
│   │             settings-quota-notifications,settings-rspamd,settings-global-filters,presets,
│   │             mass-mail,license}.ts  + (extends) public-config.ts, password-policy.ts, index.ts
│   ├── scenarios/system-settings.ts  + (extends) state.ts, index.ts
│   └── factories/{settings,rspamd-rule,regex-map,mass-mail,preset}.ts
├── fixtures/{logos/,email/hostile.html}
├── e2e/
│   ├── fixtures/a11y.ts                               # (extends 001) limit-palette passes
│   └── system-settings/{navigation,branding,colours,sign-in-and-app-links,passwords,quota,
│                        rspamd-rules,filter-maps,global-sieve,mass-mail,server,history,
│                        security,polish}/*.spec.ts
└── smoke/system-settings/*.smoke.spec.ts
```

**Structure Decision**: The single static frontend of UI 001, with one new feature folder
(`src/features/system-settings/`) behind the `system` navigation entry, organised by group inside.
Building blocks with uses outside the feature or with two or more uses go to `src/shared/` (code
editor, e-mail preview, contrast maths, entry-list helpers) or to `src/app/branding/` (shell
colours). Entry points into UI 002's domain page and UI 005's filter form import only from
`@/features/system-settings`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| A periodic request (constitution VII "never refetches without reason"; 001-R9 "no `refetchInterval` anywhere"): the running mass mail job is refreshed every 5 s. | FR-088 and SC-009 require progress at most 10 s behind while the page is visible, and the API offers no push channel. The refresh runs only while the job runs, the page is visible, the user has not paused it and has interacted within the shared inactivity limit (`min(15 min, idle timeout)`), and stops at the end (R23); this is the condition-bound polling that `docs/conventions.md` allows. | Manual refresh only: fails SC-009. Refreshing whenever visible: keeps an unattended administrator session alive, against UI 001 FR-033. |
| The recipient preview's search and page are not kept in the page address (conventions "Lists"). | The preview belongs to an unsent draft that FR-108 keeps in memory only; putting its paging in the address would let Back and history navigate a transient draft and write selection-derived state into history. | Address-based paging: conflicts with FR-108 and loses the draft on Back. |
| Two English server diagnostics appear inside translated messages (constitution IV "all user-facing text from translation files"): the Sieve parser message and Dovecot's delivery reply. | FR-069 requires the parser's reason; the contract carries it only as English text (`sieveSyntax.message`), and Dovecot replies have no code yet (API gap G1). They are quoted and marked as the server's message, never shown as the whole message (R10). | Hiding them: violates FR-069 and leaves administrators without the cause. Translating by pattern matching: unreliable and unmaintainable. |

### Password Settings slice verification (2026-10-20)

The actual policy checkbox order comes from `password_complexity('get')` in
`inc/functions.inc.php`, consumed by the template foreach: letters, special characters,
mixed case, numbers. The form map above is corrected to that order. The owner-directed
Options tab opens `/system/password-policy` as Password Settings; the reset-email form
will be the second section of that destination. Existing passwords are unaffected,
and the preview and explanatory note implement the already-approved FR-044.

Policy checkpoint evidence: 36 focused unit checks and 24 browser executions pass
(desktop/mobile Chromium and mobile WebKit), including both-theme accessibility,
360px reflow, touch targets, roles, demo transitions, validation, stale versions,
leave protection, History, and the shared policy in mailbox creation. The isolated
API smoke changed the minimum length and restored the exact original policy and
ETag in a finally block. Typecheck, lint, i18n, production build and the initial
bundle budget pass (194.4 KiB gzip of 200 KiB). Reset-email tasks remain open.


### Password reset email checkpoint (2026-10-20)

The owner-requested Password Settings destination contains policy and recovery settings
on one page. `/system/password-reset-email` redirects to its recovery section. The
classic recovery form retains sender, subject and collapsed text/HTML template order,
its exact labels and `success.saved_settings`. The approved FR-046 restore action,
FR-047 disable confirmation and FR-048 warnings are implemented. Both default bodies
are projected by the API from empty stored values; changing one default body explicitly
preserves the other displayed body, whereas changing only the sender/subject never
persists the default templates.

`TemplateField`, `EmailPreviewDialog` and the email sanitizer remain feature-local until
there is a second actual consumer. The textarea implements the relevant FR-072 editor
behavior with native keyboard navigation, wrapping and UTF-8 size limits. Preview uses
no new dependency or CSP permission: DOMPurify allowlisting, inert image/link replacements,
safe CSS declarations through CSSOM, and a scriptless no-src iframe. Initialization covers
both an already-loaded blank document and its load event. The hostile fixture includes
40 inline attributes. The app dialog receives both-theme axe checks; its operator-authored,
scriptless frame cannot run axe and is excluded from that audit, with its accessible title
and content isolation asserted separately.

Validation evidence: 45 focused unit checks; 51 unique browser cases across desktop/mobile
Chromium and mobile WebKit (48 initial form passes and all 12 affected checks passing after
the preview fix); read-only isolated API smoke confirms the returned sender/subject
availability, default markers, exact text/HTML bodies and working preview. Policy's earlier
reversible write/restore smoke also passed. Typecheck, lint, i18n, build and bundle checks
pass; the reset build has 199,002 bytes of initial gzip JavaScript (limit 204,800).
T090's rule coverage reuses the shared policy-rules suite and policy-page live draft test;
placeholder copying and reset page confirmations have focused unit coverage.

API discrepancy: T018 documents local-domain senders such as `quota-warning@localhost`,
which the UI and mocks accept. The pinned API's `EmailAddress` delegates to PHP
`FILTER_VALIDATE_EMAIL`, which rejects that address. Server errors remain mapped to the
sender field. Root is tracking backend parity; no API code was changed in this UI slice.

### Quota notification slice implementation notes (2026-10-20)

- The owner’s Options → Quota notifications destination uses `/system/quota-notifications`.
  The classic sender, subject and collapsed HTML template remain in their original order with
  one versioned save. The template help and domain-copies pointer have their own anchors;
  splitting the legacy form into independently saved resources would misleadingly imply separate
  API versions. D10 remains unresolved: the domain copy recipients keep the legacy textarea,
  with the existing multi-entry parser accepting pasted separators and preserving the first
  spelling of case-insensitive duplicates. No tag editor was introduced.
- Default quota sender, subject and template are projections. PATCH includes only changed fields,
  so changing the subject never sends `quota-warning@localhost` as a custom sender. Empty strings
  restore the individual default. Explicitly saving a custom local-domain sender can receive the
  API’s existing email validation error, displayed on the field with the draft retained.
- The settings capabilities endpoint is administrator-only; domain capabilities do not expose
  `quotaNotificationRecipientsMax`. Administrators use the advertised settings limit. Domain
  administrators use the recipients schema’s fixed maximum of 100 and never request the forbidden
  settings endpoint; the API remains authoritative. A capability addition would remove this
  contract split. The component is keyed by domain to dispose drafts when navigation changes scope.
- Recovery and quota emails are now the two concrete consumers of the shared `TemplateField`,
  `EmailPreviewDialog` and sanitized preview profile. The editor wraps the shared native
  `CodeEditor` with line numbers disabled to preserve the classic form. No runtime dependency or
  CSP exception was added. Preview isolation and hostile-email regressions remain applicable to
  both consumers. Read-only email contents stay inside the editor’s own scroll area.
- Copies are stored separately from domain lifetime; removing and re-creating a domain exposes
  the retained recipients again. A missing or newly inaccessible domain keeps the draft visible,
  explains that it was not saved, and disables further writes. History is administrator-only.

Validation: 61 focused unit/component checks, 75 browser executions across mobile Chromium,
desktop Chromium and mobile WebKit (quota, domain details, recovery editor and hostile previews),
and two local real-API smokes pass. The API smoke restored the original copy recipients and
active state in `finally`; the version may differ when an originally absent Redis field becomes
an explicit empty record. Typecheck, scoped lint, formatting, translation completeness and the
production bundle budget pass (199,398 / 204,800 initial gzip bytes). Logs are in
`storage/app/restart-2026-10-20/u013-password/quota-*.log` in the API workspace.
