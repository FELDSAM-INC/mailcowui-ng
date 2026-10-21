# Structured settings errors — T020 and T033

Reviewed 2026-10-21 against UI base `8d50257f` and pinned API
`dd9a44ec76b39d6aaaceacbb9512409494a19cdb`. This audit reconciles the task's proposed
central formatter with the actual consuming components. It does not claim a new full-suite,
physical-device or human translation review.

## Confirmed gap and correction

The mobile System mails composer returned to Recipients after every send refusal, including
errors belonging to Message. A single sender refusal therefore had neither a visible field
error nor a summary (the summary starts at two fields). This is reachable with
`noreply@localhost`: the deliberately permissive UI email precheck accepts local domains, while
the API's `EmailAddress` rule rejects this custom sender. No API behavior change is required.

The composer now reveals the step containing the refused field. For mixed selection/message
errors it opens Recipients first; each summary link reveals its own target step before focusing
the field. A late refusal still renders and announces the error, but does not take focus back
after the user deliberately moved elsewhere. Existing confirmation, drafts, selection preview
and job-creation semantics are retained. These checks use the contract-validated mock API;
they do not submit real mail jobs.

The test-first run failed five assertions covering the hidden field, hidden summary target and
focus ownership. After correction, the focused seven-file unit set passes **46/46**. It includes
`MassMailSendPage.errors.spec.ts`, `useMassMailCompose.spec.ts`, shared `forms.spec.ts`,
`problems-settings-coverage.spec.ts` and the existing selection/component/API suites.
The browser validation and final static evidence are recorded below.

## Parameter and consumer reconciliation

The 20 construct/reason values below are the values named by the pinned contract description
and data-model §8. Each has a consuming message path; unknown future values use a neutral
fallback rather than displaying the API's raw diagnostic. Source reconciliation covers all
listed values. Existing component/browser tests exercise representative outcomes, not every
construct in every locale and viewport.

| Requirement | Consuming path | Existing assertion evidence |
| --- | --- | --- |
| `tooLong`, `unit: bytes` | `src/i18n/problems.ts` formats `max` with the shared binary-size formatter. `LogoCard.vue` combines the classic size refusal with the authoritative byte limit. | `problems-domains.spec.ts`, `problems-005.spec.ts`, `problems-006.spec.ts`; logo browser case “lowered server limits” verifies the returned 64-byte limit and preserved saved logo. |
| `insufficientContrast` | The shared formatter retains formatted ratio, minimum and surface; `ColourField.vue`/`ColoursPage.vue` consume the message. | `problems-colours.spec.ts` checks 4.42, 4.5 and `#ffffff`; Colours unit/browser cases cover server refusal. |
| `unsafeSvgContent.construct` | `LogoCard.vue` maps all nine values to `systemSettings.logos.construct.*`: `scriptElement`, `eventHandlerAttribute`, `scriptUrl`, `foreignContent`, `externalReference`, `styleImport`, `doctype`, `notWellFormed`, `rootNotSvg`. It renders the formatted line and has an `unknown` fallback. | `branding-api.spec.ts` preserves returned construct/line; logo browser case “refuses a renamed PDF…” checks the API script-element refusal. File-classification and malicious stored-image tests cover the separate image boundary. |
| `unbalancedStructure.construct` | `RuleForm.vue` maps all five values to `systemSettings.rules.*`: `unclosedBrace`, `unexpectedBrace`, `unclosedBracket`, `unexpectedBracket`, `unclosedString`. Unknown values use `invalidStructure`; marks and summary contain the line. | `RuleForm.spec.ts` checks the returned unclosed-brace mark at line 2, clearing stale marks and valid content. `spam/rules.spec.ts` exercises Check, line navigation and save. |
| `invalidRegexLine.reason` | `FilterMapPage.vue` maps `notSlashDelimited`, `tooManyFlags`, `innerSlash`, `doesNotCompile` to `systemSettings.filterMaps.reasons.*`. Local structural checks cover the first three; PCRE compilation remains authoritative on the server. Unknown values use `validation.invalid`. | `regex-lines.spec.ts` covers local reasons; `regex-map-api.spec.ts` preserves the PCRE reason/line. `filter-maps.spec.ts` checks local and server marks, their messages and Go to line. |
| `notEligible.reason` | `MassMailSendPage.vue` uses `systemSettings.massMail.form`; the shared formatter strips numeric path indices and resolves include/exclude-specific `notReceiving` and `outsideSelectedDomains` messages. `RecipientSelection.vue` displays the indexed error. | Added three locale tests in `problems-settings-coverage.spec.ts` cover both lists × both reasons in en/cs/sk (12 combinations, three test executions). The mounted compose test checks the actual indexed entry and both summary destinations. |
| `invalidFormat` | Existing dispatcher selects the message for `email`, `singleLine`, `appLinkUrl`, `hexColor`, `origin`. Consumer-specific legacy messages take precedence where appropriate. | The compose refusal checks `danger.from_invalid`; `problems-settings-coverage.spec.ts` checks the other four formats in en/cs/sk, including the classic CORS origin error. App links retain `type="text"` with URL input hints because valid API URLs include single-leading-slash relative paths. |
| `sieveSyntax` | `GlobalSieveFilterForm.vue` preserves `danger.sieve_error` around the diagnostic, neutralizes control characters, and renders only the diagnostic as a plain-text `<q lang="en">`; its line is an editor mark. HTML quotation belongs to this component, not a generic string formatter. | `GlobalSieveFilterForm.spec.ts` supplies hostile HTML and bidi text, checks `lang="en"`, no injected element, line 2 and stale-mark clearing. `problems-005.spec.ts` checks the classic message mapping. |
| Unknown rule code | Shared `violationMessageKey` returns `validation.invalid`, with no server prose. | `problems.spec.ts` and `problems-domains.spec.ts` directly assert the fallback; the settings coverage test additionally checks no raw diagnostic or unresolved placeholders. |

## Problem types, rule codes and legacy outcomes

`src/i18n/legacy-messages.ts` and the consumer messages provide the T033 mappings. In particular,
Sieve uses `danger.sieve_error`, demo mode uses `danger.demo_mode_enabled`, image size/dimensions
use `danger.img_size_exceeded`/`danger.img_dimensions_exceeded`, and invalid image/type use
`danger.img_invalid`/`danger.invalid_mime_type`. The three classic image outcomes are asserted
verbatim in `problems-settings-coverage.spec.ts`.

That suite also checks the settings-specific rules (`unsupportedImageType`, `invalidImage`,
`imageDimensionsExceeded`, `unsafeSvgContent`, `insufficientContrast`, `invalidRegexLine`,
`unbalancedStructure`, `tooFew`) without rendering raw server prose. The existing common
`mutuallyExclusive` rule remains shared. The construct/reason-specific meanings are supplied by
the consumers above, rather than unused `validation.params.*` aliases.

| Problem types | Consuming behavior and evidence |
| --- | --- |
| `demo-mode`, `feature-disabled` | Capability/read-only boundaries and translated refusal remain in settings pages. Existing `SettingsLayout`, branding/password/License and navigation tests verify access and no-write behavior; the settings message suite checks the feature-disabled mapping. |
| `regex-map-unavailable`, `global-sieve-filter-unavailable` | Map/Sieve pages keep readable data or drafts, explain unavailable backing files and block inappropriate writes. Their API/component/browser suites cover unavailable and vanished resources; the settings message suite checks both names. |
| `mass-mail-already-running`, `mass-mail-recipient-count-changed` | Composer offers the running-job link or refreshes the preview and requires new confirmation. Existing `useMassMailCompose.spec.ts` and `mass-mail/compose.spec.ts` exercise these transitions; the message suite checks both mappings. |
| `container-action-failed`, `outcome-unknown` | Rspamd UI password page distinguishes service failure from unknown outcome, clears the secret and offers an explicit retry. Existing `RspamdWebInterfacePage.spec.ts` and its browser suite check both outcomes. Global Sieve separately reports saved/restart outcomes. |
| `temporary-failure` | Shared problem handling supplies translated service-unavailable feedback; page retry/draft-preservation checks cover failed reads/writes. The exact shared message is already covered in `problems-005.spec.ts`; no feature-specific raw API detail is substituted. |

T020/T033 can be reconciled to these implementation and assertion locations once the compose
correction is integrated. The proposed monolithic test filename and central construct/reason
namespace are superseded by these consuming paths; their absence is not unfinished behavior.
This does **not** mark the broader T167–T175/full-suite gates complete. Authorized English-source
fallbacks for new cs/sk explanations remain listed in `i18n-english-fallback-review.csv` for
human wording review; resolving a key is not a claim that its human translation review passed.

## Validation evidence

Evidence directory in the API workspace:
`storage/app/restart-2026-10-20/u013-settings-errors/`.

- `unit-red.log`: five intended failures before the correction; `unit-final.log`: **46/46**
  focused checks pass across seven files. No new assertion was weakened to obtain a pass.
- `browser.log` / `results.json`: **14/15** initial executions pass. All nine new refusal
  executions passed. The existing successful-send case found a WebKit contrast failure when
  the confirmation's inherited dark text remained light after changing to the light palette.
  `SendConfirmDialog.vue` now gives its text the existing explicit light/dark foreground classes.
- `browser-final.log` / `results-final.json`: the affected successful-send case passes
  **3/3** across 360 px Chromium, desktop Chromium and 360 px WebKit. In total, **15 distinct
  executions** have green evidence; the three final executions are reruns, not extra unique
  coverage. Both runs use two workers and zero retries. Four-palette axe assertions are unchanged.
- Scoped ESLint, formatting, full app/test typecheck, final production build and bundle budget
  pass. Initial JavaScript is **189,652 / 204,800 bytes gzipped**. No Lighthouse timing claim is
  made by this focused correction.
- The test container and mock/preview ports 4088/4254 are stopped. No shared-stack settings,
  fixtures or mail jobs were changed.
