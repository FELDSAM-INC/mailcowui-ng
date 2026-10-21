# Foundation and early-story reconciliation — 2026-10-21

This read-only inventory compares the task wording with main `d8398d94` and the subsequent
settings-discovery work. It does not mark a full-suite or manual gate complete. The owner’s later
grouped sidebar, shared content tabs, Customize children and combined Password Settings page
supersede the old dedicated SettingsNav/PageSwitcher and seventeen separate page files.

| Tasks | Existing implementation and evidence | Reconciliation |
| --- | --- | --- |
| T001 | `contract/VERSION.json`, `contracts/README.md`, generated schema and public types in `src/api/index.ts`; pin `dd9a44e` includes the recorded baseline/previous pin. | Pin/export work is complete. The task also asks for the whole unit and browser suites; retain that broader gate unless separately run. |
| T002–T007 | `tests/unit/api/system-settings-operations.spec.ts` guards all 51 consumed operations; query-key/legacy-formatter tests and `tests/unit/mocks/validator-binary.spec.ts` cover the reused roots, `%d` and binary upload validation. | Already checked; no replacement formatter/validator needed. |
| T008–T012 | Typed `SettingsMockState` and the separate mass-mail state in `tests/mocks/scenarios/`; `factories/settings.ts`; `settings-*` handlers and public-config projection now cover every delivered settings slice. | The first-slice “partial store” note is stale. Scenario names are split by story; failure injection supplies transient cases without requiring every planned alias. |
| T008a, T039 | `plan.md` form map and each page’s legacy keys; new feature message files; per-checkpoint i18n results. | Implemented mapping, with explicitly authorized English-source fallback for new cs/sk explanations. T180’s automated checks and owner-review handoff are complete; human wording review remains a separate follow-up. |
| T013, T026 | `src/shared/color/contrast.ts`, `tests/unit/shared/color/contrast.spec.ts`, Colours checkpoint `833d73c0`. | Implemented and tested; keep colour math separate from the still-open editor timing gate. |
| T014, T027 | Shared `code-editor/CodeEditor.vue`, lazy large editor, line layout and text-change helpers; `tests/unit/shared/components/code-editor.spec.ts` and editor browser evidence. | Functional editor work is delivered under evolved filenames. T120/T127 cold WebKit latency and physical IME/screen-reader validation remain open. |
| T015–T017, T028–T030 | `src/shared/lib/email-html.ts`, `src/shared/components/email/EmailPreviewDialog.vue`, `lib/email-samples.ts`, `tests/unit/features/system-settings/email-html.spec.ts`, password/quota suites and `tests/e2e/system-settings/security/email-preview-isolation.spec.ts`. | Shared scriptless iframe/allowlist boundary and samples are delivered. Password/quota previews are actual consumers; no duplicate planned wrapper is necessary. Do not infer every listed hostile-vector assertion solely from a filename match. |
| T018, T031 | `src/shared/validation/email.ts`, existing `entry-list.ts` and its tests, reset/quota/selection tests. | Local-domain sender precheck and split/trim/case-insensitive duplicate handling exist. Consumer validators enforce limits. The API’s custom local-domain rejection is documented; minimal patches preserve projected defaults. |
| T019, T032 | Existing `EntryListField.vue` and `tests/unit/shared/components/EntryListField.spec.ts`; current quota/CORS/selection forms. | Planned TagEditor is superseded by the approved legacy textarea/select forms and existing pickers. Do not create an unused chip editor solely to match this filename. |
| T020, T033 | `src/i18n/problems.ts`, existing domain/account problem tests, `problems-colours.spec.ts`, story validation/API tests and translation coverage guard. | [Structured-error audit](structured-errors-audit.md) reconciles all 20 named construct/reason values, formats and outcomes to their consumers and assertions, and records the confirmed mobile compose error-visibility correction. The proposed monolithic filename/namespace is unnecessary; no exhaustive browser-per-value or completed human wording review is implied. |
| T021, T035 | Current typed catalogue and lazy routes; discovery adds section/field/legacy labels and `catalogue-complete.spec.ts`. | Seventeen planned destinations resolve to sixteen discovery pages because reset email is a section of Password Settings. Its old route redirects to the real anchor. Search also includes the existing delivery-job list. |
| T022, T023, T036 | `useSettingsSection.ts`, `tests/unit/features/system-settings-section.spec.ts`, canonical `useLeaveGuard`, and password/branding/quota browser tests. | Versioned minimal patches, explicit stale retry/discard, no-op save, demo/error draft preservation and leave guards are delivered. Current multi-section forms block a second editor with an explanation; this replaces the task’s second “switch section” confirmation. |
| T024, T025, T038 | `SettingsLayout.vue`, `system-settings-capabilities.spec.ts`, `SettingsLayout.spec.ts`, navigation `foundation.spec.ts`, registered admin-only settings routes. | Loading/retry/role/no-request behavior is delivered. Sidebar wording/layout follows the later owner request, not the old System-settings sidebar entry. |
| T034 | `api/capabilities.ts` and five-minute query tests; CORS limit in shared constants and contract limit tests. | Complete after the limits follow-up in evidence-settings-discovery.md: app-link URL 2048 and quota-recipient 255 now have shared constants reused by validators and displayed errors, with direct pinned-schema assertions. Both public and signed-in app-link URL schema paths are guarded. |
| T037 | Shared `EditableSection`, `PageHeader`, `ProblemMessage`, HistoryLink and page-specific demo/default/status rendering. | Delivered behavior reuses existing primitives. Planned one-use wrapper filenames are unnecessary. |
| T040 | `contracts/README.md`, plan API-gap notes and System-mails evidence. | G1 stable failureCode and G17 body-free summary contract are already pinned and consumed; raw SMTP details are not rendered. |
| T041 | Existing navigation foundation/grouped-layout/role tests, plus discovery search and section-focus tests. | Old dedicated SettingsNav/PageSwitcher assertions are obsolete. Search/section links/Back/no-request/count/performance checks are completed in the discovery checkpoint once its final results are recorded. |

## US2 and US4

- **T052–T064 and T065’s shipped flows:** `docs/checkpoints/ui013-customize.md` records **272/272**
  focused units, **78/78** final browser executions (not added to the superseded first run), and
  **1/1** reversible local product-name smoke. Evidence is under the API workspace’s
  `storage/app/restart-2026-10-20/customize/`. The checkpoint documents the approved contract
  limitation: deletion confirmation shows the current logo plus restoration text because the
  API does not expose the default URL before deletion; the actual default is shown afterward.
- **T077–T085:** `evidence-login-app-links.md`, checkpoint `90007e78` / main `5e36936a`, records
  **26/26** focused units, **39 distinct** browser executions and **1/1** reversible login-flag
  smoke. All generated operations, whole-list save/order, validation, conflicts, demo state,
  public-config refresh and field order are implemented. Newly authored cs/sk explanations
  retain the same pending human review as US2.

No whole-suite, physical-device, moderated-admin-discovery or real-screen-reader validation is
claimed by this audit. Root owns the combined local smoke recipe and release gates. Cold first-key
editor latency remains open independently of the successful functional editor tests.
