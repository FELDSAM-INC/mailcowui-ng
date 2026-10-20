# Settings discovery follow-ups — 2026-10-21

## Section-fragment focus (T044/T047)

The existing Password Settings reset-email deep link now focuses the section heading, including
on an initial visit and when the section's data arrives later. A MutationObserver waits at most
three seconds; a missing or malformed target falls back to the ordinary page heading. Hash-only
navigation is handled, while query-only updates preserve the current control. Navigation and
user interaction cancel a pending wait. Fragment values are decoded safely and resolved as ids
inside main, never interpolated into CSS selectors. Scroll restoration remains authoritative;
other targets use native scrolling with the shell's existing sticky-header padding.

- The new regression initially failed six of eight cases. Final router suites: **18/18 passed**.
- Browser checks: **6 distinct executions passed** across mobile Chromium, desktop Chromium and
  mobile WebKit. Initial three failures were a keyboard assertion that skipped the existing
  History link before Edit; correcting that test produced **3/3** on the affected rerun without a
  product change. The checks cover delayed reset-email redirects, focus and header visibility,
  sequential keyboard access, missing-fragment fallback and normal navigation.
- Full typecheck, scoped lint, Prettier, production build and bundle budget pass. Logs are
  `/tmp/u013-focus-hash-*.log`. Browser logs and traces are in
  `/home/feldsam/Projects/mailcow-rest-v2/storage/app/restart-2026-10-20/u013-discovery/`.
- No settings writes or API mutations were needed. The user's grouped sidebar and shared tabs
  are unchanged; this fills the remaining deep-link accessibility behavior.

## Catalogue search and completeness (T042/T046/T049/T050/T179)

The existing settings overview now searches static page names, section headings, field labels,
descriptions and legacy names. It includes the installation’s already-loaded English fallback
alongside the selected locale, ignores accents and case, and requires every search token.
One result per page points to its best matching section; ties keep catalogue order. Query `q`
uses replace navigation, so Back from a result restores the search without adding a history entry
for each keystroke. Results update immediately; only the polite count waits 500 ms. Clearing an
empty search result returns focus to the field. Hidden License and unregistered routes never enter
the index. No saved settings, bodies, map contents or other dynamic values enter the index.

The catalogue guard checks all seven groups, real lazy routes/components, message references,
contract audit targets and actual heading/section anchors. The original seventeen destinations
resolve to sixteen pages because Password Recovery is a section of Password Settings; its old
route still redirects to that section. The existing delivery-job list is now discoverable too.
This consolidates T179 rather than creating obsolete SettingsNav/PageSwitcher components or an
artificial seventeenth page. The current grouped sidebar and shared content tabs are preserved.

## Contract messages and source-language review (T180)

The new nine-case message regression initially failed all nine cases. The implementation closes
the sixteen uncovered contract values without copying legacy wording or eager-loading feature
translations:

| Contract values | Mapping |
| --- | --- |
| `unsupportedImageType`, `invalidImage`, `imageDimensionsExceeded` | Existing `danger.invalid_mime_type`, `danger.img_invalid`, `danger.img_dimensions_exceeded`, verbatim. Detailed logo limits remain in the existing form. |
| `optionNotAllowed`, `optionContainsSpace`, `customParamsNotPermitted` | Linked to existing sync-job field messages in their lazy locale modules. |
| `insufficientContrast` | Existing measured contrast message, now declared in the coverage manifest. |
| `unbalancedStructure` | Linked to the existing Rspamd structural error; editor-specific line/construct messages remain available. |
| `regex-map-unavailable`, `global-sieve-filter-unavailable`, `mass-mail-already-running`, `mass-mail-recipient-count-changed` | Linked to the existing feature messages; no duplicated wording. |
| `unsafeSvgContent`, `invalidRegexLine`, `tooFew`, `feature-disabled` | Minimal generic messages where no equivalent legacy text exists. Numeric line/minimum parameters are preserved; raw server diagnostics are not shown. |

`i18n-english-fallback-review.csv` is the review handoff for **240 keys** whose cs/sk text still
matches the English source (including equivalent plural choices). It covers the settings module,
shared editor/email-template messages, UI013 audit messages and new generic settings errors added
since the first settings slice. Linked aliases and verbatim legacy mappings are omitted because
they reuse their target text. Exact matching is a review aid: some technical names or units may
correctly remain identical. No machine-translated Czech or Slovak text was added, and human review
of this list remains open. The explicitly authorized source-English fallback is not reported as
completed human translation.

The translation checker now reports **715 covered contract keys and zero uncovered contract
values**. This automated completeness result is separate from human wording review. Full-suite,
physical-device, moderated discovery and real-screen-reader gates remain outside this checkpoint.

### Final focused verification

- **147/147 unit/component tests** passed across eight focused suites: search, overview,
  catalogue completeness, legacy loading, generic problems, new settings coverage, Colours
  refusals and existing sync-job field messages. Search’s initial red run failed on the absent
  search module; the message regression separately failed **9/9** before its mappings existed.
- **9/9 browser executions** passed on mobile Chromium, desktop Chromium and mobile WebKit,
  with two workers and zero retries. The existing extended axe fixture checked search and empty
  states in **light/dark × saved/limit palettes**. Cases also cover section-heading focus, Back,
  clear focus, URL query state, Czech accent-insensitive matching, English legacy aliases,
  hidden License, static-only indexing, touch targets and horizontal reflow.
- The browser DOM-input-to-next-frame assertion stayed below **300 ms** on every profile; the
  pure search median stayed below **5 ms** over fifty samples. These are automated checks on the
  current machine, not physical-phone performance or moderated usability validation.
- Forced full app/test typecheck, scoped ESLint, formatting, production build and bundle checks
  passed. Initial gzip payload: **189,189 / 204,800 bytes**. Static logs are
  `/tmp/u013-discovery-{units,types,lint,lint-rerun,build,budget,i18n}.log`.
- Browser log:
  `/home/feldsam/Projects/mailcow-rest-v2/storage/app/restart-2026-10-20/u013-discovery/search-browser.log`.
  The isolated browser/previews stopped after completion. No API settings writes were required.
