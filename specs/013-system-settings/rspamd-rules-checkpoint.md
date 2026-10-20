# UI013 Rspamd rules checkpoint

Scope: T106–T117 (US7), with the shared native editor from parent checkpoint `6752b279`.

Implemented rule list/search/active filter/sort/paging URL state, create/edit/server Check,
structure marks and line navigation, explicit optimistic-concurrency recovery, deletion with
fresh confirmation after a stale version, read-only effective map with retry/copy, and
trusted legacy preset headlines with the API headline as fallback. The API keeps full rule
content/version tags in list responses; the effective map returns only `content`.

Sieve creation now uses the public lazy PresetPicker and shared CodeEditor. Existing script
byte count, metadata, permission checks, validation-before-create, validate-and-save edits,
and dirty-form guards remain covered. The old ScriptEditor component was removed.

The modules are separated as `api/rspamd-rules.ts`, `api/presets.ts`, and isolated rule/preset
mock handlers to avoid coupling them to Rspamd password handling or concurrent regex-map
work. Rule list orchestration lives in its page; check feedback is rendered next to the shared
editor's marks instead of separate pass-through RuleList/CheckResult components.

The copy fallback now focuses/selects native input or textarea values while preserving their
keyboard Tab order; non-control text still uses the existing Range selection. A browser-reproduced mobile preset overflow was fixed by
passing wrapping/width overrides through the shared button class merger.

## Localization

Legacy descriptions, field labels, preset headlines, insertion actions, help links, CRUD
outcomes and generic confirmation text are reused. New `systemSettings.rules.*` values
are explicit English source fallback in cs-cz/sk-sk pending human wording, as authorized by
the parent. They are not claimed as completed translations:

- description
- refreshNote
- deleteImpact
- replaceTitle
- replaceBody
- unclosedBrace
- unclosedBracket
- unexpectedBrace
- unexpectedBracket
- unclosedString
- invalidStructure

The shared editor's `codeEditor.*` source fallbacks remain tracked by its own checkpoint.

## Validation

- 74 unit tests passed in 19 files (system settings, Sieve filter integration, CopyButton).
  After a final native-control Tab-order regression was reproduced, the six CopyButton tests
  passed again with the corrected fallback.
- Typecheck, scoped ESLint, formatting, and i18n checks passed. The i18n check's mechanical
  completeness result does not resolve the explicitly documented source fallbacks above.
- Production build passed; initial gzip size is 202,994 of the 204,800-byte budget at this
  branch's baseline. The integrated main build must be measured separately.
- All 60 unique browser executions now have passing evidence: 20 cases on mobile Chromium,
  desktop Chromium, and mobile WebKit. The full run passed 47/60; a focused rerun passed 17/21;
  the final six preset cases passed 6/6. These are overlapping reruns, not 81 unique cases.
  A further three effective-map copy cases passed after the native Tab-order correction.
  All 21 pre-existing Sieve executions passed in the full run. Axe checks cover both themes,
  with 320/360px reflow, dirty navigation, native copy fallback, CRUD, stale versions,
  role denial, URL state, and translated/API-fallback presets.
- Browser fixes: wrapped preset buttons, a Copy accessible name containing its visible
  label, precise contextual-link selectors, and full-page axe positioning after scrolling
  an unrelated button under the sticky header. Explicit geometry assertions verify preset
  buttons remain at least 44px high.
- Local API smoke passed 1/1 (13.3s): Check, create a uniquely named inactive rule, delete,
  confirm GET 404, and sign out. The first setup attempt used an IPv6-only preview binding;
  the next attempt exposed a five-second dependency timeout racing a five-second UI
  assertion. The final test explicitly waits for the actual map response. No active rule
  was changed and no service was restarted.

The local API's effective-map URL is `http://nginx:8081/settings.php`, while its isolated web
service has only `web`/container aliases and no URL override. Authenticated GET returned the
contract's 503 temporary-failure response. Its retry UI was verified; actual generated map
content was verified with contract-validated mocks, not with the unavailable local dependency.
The dependency configuration was left untouched.

Logs, traces and screenshots are saved outside the UI worktree under
`mailcow-rest-v2/storage/app/restart-2026-10-20/rspamd-rules/`. The frozen browser build is
`dist-u013-rules`; all associated containers and previews were stopped after validation.

The existing mailbox route regex accepts literal `@` but rejects a manually percent-encoded
`%40` path before parameter decoding. App-generated named links use the working literal form;
the shared route issue was reported separately and is outside this checkpoint.

T108's assertion that Global Sieve offers no examples belongs to the forthcoming US9 page;
that page is not registered at this baseline, so this checkpoint does not invent a test of a
nonexistent form. No global Sieve preset integration is added.

## Integrated main validation — 2026-10-21

Merged with the TailAdmin shell, acting sessions, quota notifications, and shared editor
geometry cache. The Options tab now opens Rspamd settings map. All 48 focused browser
executions passed on mobile Chromium, desktop Chromium, and mobile WebKit, including
Rspamd rules, Sieve presets, Options navigation, and shared-editor quota/password-reset
regressions. All 127 focused unit tests passed in 31 files. Typecheck, scoped ESLint,
i18n completeness, production build, and bundle budget passed. Initial JavaScript is
186,745 of the 204,800-byte gzip budget; localization fallbacks above remain explicit.

Integration evidence is retained under
`mailcow-rest-v2/storage/app/restart-2026-10-20/rspamd-rules/integration/`.
