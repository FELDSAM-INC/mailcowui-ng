# System mails validation — 2026-10-21

Implemented UI013 US10 (T135–T146) on contract pin `dd9a44e`:

- Compose: receiving-mailbox selection, domain limits, include/exclude chips and pasted addresses;
  paged preview and search; classic sender/subject/text/optional HTML fields; isolated HTML preview;
  one explicit confirmation with the exact recipient count; demo/read-only and dirty-leave handling.
- Conflicts: a changed recipient count requires another preview and confirmation; an existing job
  preserves the draft and links to the running delivery; entry validation returns to recipient selection.
- Jobs: body-free summary listing, URL filters, detail, translated stable failure codes, five-second
  refresh that pauses for hidden/inactive pages, explicit pause/resume, cancellation and completed-job races.
- Slow preview responses cannot overwrite a newer search; preview selection and message drafts stay
  in memory. Raw SMTP diagnostics are never rendered.

## Evidence

Artifacts are under
`/home/feldsam/Projects/mailcow-rest-v2/storage/app/restart-2026-10-20/u013-mass-mail/`.

- `browser-final.log`: 42 passed; six failures were two test assertion details repeated in three
  profiles (native select options included in the picker count, and literal versus encoded `@` in URL).
- `compose-final.log`: 27/27 passed after correcting those assertions and restoring the exact legacy
  Include/Exclude label/help. Together, **48 distinct browser checks pass** on mobile Chromium,
  desktop Chromium and mobile WebKit, with zero retries. Includes keyboard step focus, axe,
  320/360 px reflow, touch targets, preview/send conflicts, paused/hidden/inactive refresh, final
  refresh invalidation, cancellation, empty/unknown jobs and browser Back filter restoration.
- `smoke.log`: **1/1 passed** against the isolated API on port18580 through preview4245. The preview
  count equals the API receiving-mailbox count; the test asserts zero create-job requests. No mail
  is sent, no maildev settings are touched, and the isolated stack is retained.
- Focused units: **29 distinct cases** cover selection/UTF-8 validation, all seven generated
  operations, stale preview responses, draft transitions, refresh lifecycle/announcements,
  confirmation text/plurals, progress text and shared picker filtering. Initial red tests were
  observed before implementation and for each later race/validation/legacy-label fix.
- App and test typechecks use independent build-info files; scoped ESLint, Prettier, i18n and
  `git diff --check` pass. Build output: `dist-u013-mass-mail`; initial gzipped JavaScript is
  **186721 / 204800 bytes**.

## Implementation decisions

Plan D3 follows the already specified FR-080–089 flow and existing authorization to complete System
mails; this records an implementation decision, not a new user quotation. There is one final Send
confirmation, replacing the classic activation checkbox. Classic message-field order and meanings
remain. Legacy default-selection help appears only for the all/no-exclusion mode, where it is true.

The contract closes G1/G17: `MassMailRecipient.failureCode` provides stable translated reasons and
`MassMailJobSummary` excludes bodies. Unknown future failure codes use a generic refusal label.

Shared DomainPicker, MailboxSearchPicker, CodeEditor, EmailPreviewDialog, useConfirm and
useInactivity are reused. The picker adds only status filtering and per-entry errors. Compose steps
and job list/detail sections stay local instead of adding many single-use wrapper files. The three
routes are `system-settings-mass-mail-send`, `system-settings-mass-mail-jobs`, and
`system-settings-mass-mail-job` with `jobId`. System mails navigation is enabled because those
routes now exist; it uses the current shell tabs and content width. Audit labels/formatters are
owned by the separate UI013 audit checkpoint and intentionally excluded from this feature commit.
