# UI013 cross-cut evidence audit and focused polish

Baseline: integrated main `d8398d94` with input-hint checkpoint `62b9e988`. This audit maps behavior to existing evidence, rather than treating an absent planned test filename as proof of an untested feature. The new bounded suite supplements the story tests; it does not close every catalogue-wide task.

| Task | Existing meaningful evidence | Remaining scope before claiming the entire task |
| --- | --- | --- |
| T167: page states | `navigation/foundation` retries capabilities; `branding/logos`, `server/cors`, `server/license` and `spam/rules` retry failed reads; rules and mass-mail jobs cover empty collections; story tests cover failed and pending writes. | Every catalogue page's delayed read/error state and every specified empty collection need a complete matrix. The polish cases add Colours, UI texts and global Sieve read/retry states. |
| T168: permissions | The shared settings route denies non-admin roles; story tests deny password policy, Rspamd, CORS/license and global scripts; quota copies check own versus out-of-scope domains and admin-only History; Sieve preset tests cover domain admins with/without `filters`. | The new mailbox case adds newer Customize routes and preset-enabled creation. It supplements the existing role tests; it is not a full cross-product of every route and role. |
| T169: reflow and focus | Both-theme axe and 320/360 reflow are exercised throughout story tests; editor wrapping, internal map review scrolling, and linked-section focus have dedicated checks. | The new short-screen Sieve dialog case adds 320×225 (400% of 1280×900), landscape, reduced motion, Escape and focus return. Other pages/steps/dialogs still need equivalent short-height evidence before this task is complete. |
| T170: keyboard | Existing tests exercise editor Tab exit, line navigation and mixed pointer/keyboard reordering. Section-focus tests verify linked headings and the subsequent Tab order. | The new app-link flow uses actual Tab/Enter/text keys for edit, reorder, removal and save. Search, other story main paths and native colour-picker platform interaction are not all covered by this single flow. |
| T171: input attributes and textual states | Native colour, URL, numeric and address controls are present; colour verdicts, line marks, entries and mass-mail outcomes have textual explanations. Input-component units cover shared email keyboard hints. | New browser assertions check representative link, colour and list-address hints. Relative app URLs require the explicit reconciliation below. A complete field inventory and all textual-state combinations remain broader than this checkpoint. |
| T172: storage and secrets | Rspamd tests inspect secret absence from storage/history/URL and clear secrets on failures; mass-mail composable units cover draft disposal and cache boundaries. | New browser cases inspect mass-mail subject/body/selection through confirmation, enqueue and a new compose session, plus denied-storage handling on representative settings/editor/job pages. Every settings page with denied storage remains a larger matrix. |
| T173: freshness | Branding mutations refresh the live shell; password-policy saves affect the next mailbox form; rule API units check invalidation; mass-mail tests cover hidden/idle/unmounted/completed polling. | New RouterLink navigation checks read counts inside the settings freshness window. Effective-map refresh after a rule mutation still lacks a dedicated cross-screen browser assertion. |
| T174: legacy parity | Story tests and legacy-key/form-map units cover logos, UI texts, flags, app links, policy, reset/quota fields, filters, CORS, license and mass mail. | The later [legacy value inventory](../../specs/013-system-settings/legacy-value-inventory.md) reconciles all 16 catalogue entries and related legacy fields to actual story fixtures and assertions. Three additional component checks cover stored flags and inactive announcement preservation. It distinguishes directly asserted values from source-only bindings; no aggregate `settings-admin-custom` or exhaustive per-scalar browser run is claimed. |
| T182: combined real API smoke | Individual feature smoke checkpoints record restored branding, flags, colours and other reversible changes; Rspamd password and service restarts are deliberately excluded by the approved safe smoke policy. | A combined system-settings run remains distinct from those feature passes. The audit smoke needs an explicit evidence-file handoff; the plain command skips it when `SMOKE_UI_TEXT_AUDIT_EVIDENCE` is unset. Absent-only map/Sieve fixture preparation remains required where documented. |

Paths in the table refer to `tests/e2e/system-settings` unless explicitly described as unit tests. Existing test definitions establish coverage scope; their release-specific pass counts belong to their original checkpoints and are not rerun or added to this checkpoint's count.

## Input contract reconciliation

T171's literal `type="url"` wording conflicts with the pinned app-link API, which accepts a single-leading-slash URL such as `/help`. HTML's native URL control treats that value as a type mismatch. These fields intentionally use `type="text" inputmode="url"`, disable automatic capitalization/correction, and use the API-aligned app validator. The browser check asserts both the mobile keyboard hint and native validity of the permitted relative value. Multiline recipient lists similarly use a textarea with `inputmode="email"`; a single email input cannot represent the supported pasted list.

`autocapitalize="off"` and `autocapitalize="none"` both disable capitalization. The browser assertion accepts either valid spelling; the first run's strict `off` expectation was a test error, not a broken input hint.

## Product changes found by the focused checks

- Thirteen settings form/editor pages now use a shared static, content-shaped loading state. It retains the existing loading wording, exposes one busy status, and hides decorative fields from assistive technology. It adds no keyboard stops or motion. Nested logo/reset/copy components and collection-state components remain outside this change.
- Chromium can blur a focused Save button when a request disables it. `EditableSection` now remembers that the save began inside its section and restores the heading after the form closes. An intentional focus move outside the section cancels that restoration, including if the outside control later blurs.
- The global Sieve restart dialog reproduced a related closing race: the trigger was still disabled when the confirmation tried to restore focus. `ConfirmDialog` waits for the caller's next render before restoring it, and checks that no new dialog or deliberate focus move superseded the request.
- At 320×225, Reka's initial `preventScroll` focus could leave Cancel below the confirmation's visible scroll area. A focus guard now brings a clipped child into view within the dialog. The short-screen browser check and a focused component regression cover this behavior.

The initial full browser run passed 19/30. Its eleven failures comprised three equivalent `autocapitalize` spellings, three unsupported 503 injections into the Sieve read operation (the contract documents 500), two Chromium post-save focus failures, and three confirmation focus failures. The first two groups were test corrections; the latter two required the product fixes above. The focused unit reproductions failed before implementation and now pass with the no-steal safeguards.

The second full run passed 24/30. It exposed that request completion and form closure can occur in separate microtasks, so the pending-save unit now reproduces that ordering. The short-screen test also needed to make a fresh Tab move after each viewport resize and wait for the shared sticky-bar guard's animation-frame adjustment before measuring focus. These changes preserve the obstruction assertion and do not scroll or focus controls programmatically.

## Validation

- **30 distinct browser executions pass**: ten scenarios across 360px Chromium, desktop Chromium and 360px WebKit. The second full run supplied 24 passes; the focused six-case rerun supplied the three keyboard passes and found the clipped dialog action; the final three-case rerun passed the short-screen dialog checks. These are complementary results, not a claim that the last command ran all 30. Every run used two workers, zero retries and the pinned Playwright 1.64.1 image.
- The suite includes both-theme axe with saved/limit palettes, production CSP checks and contract validation. Read failures cover 503 on Colours and 500 on UI texts/global Sieve. The short-screen case covers 320×780, 320×225 and 780×360, reduced motion and keyboard focus return.
- **84 distinct focused unit checks pass**: the final broader selection passed 83/83 across 21 files, followed by 9/9 dialog checks including the added clipped-focus regression. Missing loading implementation and the focus regressions were observed failing before their fixes.
- App/test typechecking, scoped lint, formatting, i18n and production build checks pass. Initial JavaScript is **189320/204800 bytes gzip** in this isolated baseline; the integration build must still retain the root's newer startup optimizations.
- Evidence is under `storage/app/restart-2026-10-20/u013-polish/` in the API workspace. Each browser run's artifacts/log remain separate. The browser container and previews are stopped. No new real API writes or smoke runs were required for these client-side changes; T182 remains explicitly separate in the audit table.

This checkpoint does not mark all of T167–T174 or T182 complete. The table above records the remaining catalogue-wide, manual and combined-smoke checks.

## Subsequent completion

T173 is now complete: the [freshness and individual History checkpoint](../../specs/013-system-settings/freshness-history-checkpoint.md)
adds the missing in-app effective-map refresh after an active rule save, with the query freshness
window held open. Its three browser profiles pass alongside the prior cache, dependent-page and
job-refresh evidence. This supersedes T173's remaining-scope cell above.

T182's later combined safe local smoke also passed all 16 executions, recorded in the feature's
[quickstart validation log](../../specs/013-system-settings/quickstart.md). Its unavailable real
effective-map dependency remains documented; successful generated-map data is covered by the
contract-validated mock. The other cross-cut and manual gates are unchanged.


T172 is now complete: the [storage catalogue checkpoint](./settings-storage-catalogue.md)
replaces the representative denied-storage loop with actual control exercises on all sixteen
consolidated settings destinations. All 51 storage/secret executions pass across three profiles.
It also found and verified the mobile Recipients heading/reflow correction.

T174 is complete against the [legacy value inventory](../../specs/013-system-settings/legacy-value-inventory.md)
and its follow-up assertions for stored logo size, Apps title, license verification time and
nonempty compose HTML. This supersedes those two tasks' earlier remaining-scope cells; T167–T171
and the independent release/manual gates remain separate.


T168 is complete against the [role/capability checkpoint](./ui013-permissions.md): 21 additional
browser executions cover remaining inherited-route denials, own-domain quota copies with every
permission flag off, mailbox denial and scoped filter creation without the filters flag. Existing
story checks provide the positive administrator and permitted Sieve paths and History rules.
The original failed frozen filter-detail navigation check remains preserved separately; the
focused correction waits for the intended detail route before inspecting its script.
