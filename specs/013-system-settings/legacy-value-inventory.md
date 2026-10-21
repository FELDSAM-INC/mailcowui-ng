# T174 legacy value inventory

Audit date: 2026-10-21. UI baseline: `457a241d4df79fd9724c09e1e359081464df6f7b`.
Contract: `dd9a44ec76b39d6aaaceacbb9512409494a19cdb`.

The approved plan's form map, subsequent owner decisions and actual catalogue were compared
with the consuming page/components and their existing assertions. **No omitted legacy setting
or incorrect binding was found.** This document is the previously missing single inventory;
it does not invent a replacement settings page, restore Home or repeat the full browser matrix.

The planned `settings-admin-custom` scenario does not exist. Its data is already represented by
the story-specific fixtures named below. A fixture name by itself is not coverage, so each row
names both the actual value/control and the applicable assertions. This inventory reconciles
that old aggregate-fixture plan to the delivered tests; it does not claim a run using a nonexistent
scenario. Per-story browser pass counts remain in their own checkpoints and are not added to
this audit's new test count.

## Current destinations

`src/features/system-settings/catalogue.ts` contains these **16** entries. Password policy and
reset email share one destination; the former `/system/password-reset-email` URL redirects to
the recovery section. Detail/edit/effective-map addresses and domain/mailbox settings below are
children or related existing screens, not additional sidebar entries.

| Catalogue ID | Address | Legacy value inventory below |
| --- | --- | --- |
| `logos` | `/system/customize/logos` | Both logo variants and metadata |
| `ui-texts` | `/system/customize/ui-texts` | Names, help, announcement, footer |
| `sign-in-page` | `/system/customize/login-page` | Three hide flags and force SSO |
| `app-links` | `/system/customize/app-links` | Operator and built-in app rows |
| `colours` | `/system/customize/colours` | New capability; no classic field to match |
| `password-policy` | `/system/password-policy` | Policy **and** reset email |
| `quota-notifications` | `/system/quota-notifications` | Email settings and domain-copies pointer |
| `rspamd-rules` | `/system/rspamd-rules` | Rule fields, presets, effective-map child |
| `filter-maps` | `/system/filter-maps` | Map names and per-map content |
| `global-sieve` | `/system/global-sieve-filters` | Prefilter and postfilter |
| `rspamd-web-interface` | `/system/rspamd-web-interface` | Password and repeat inputs |
| `cors` | `/system/cors` | Origins and methods |
| `ip-check` | `/system/ip-check` | Opt-in state |
| `license` | `/system/license` | GUID and verification details |
| `mass-mail-send` | `/system/mass-mail/send` | Compose fields and recipient choice |
| `mass-mail-jobs` | `/system/mass-mail/jobs` | New delivery history; no classic field to match |

The existing `catalogue-complete.spec.ts`, settings discovery and navigation tests own catalogue
completeness and reachable sections. This inventory adds no navigation or route changes.

## Field inventory and existing evidence

Abbreviations: **E** = `tests/e2e/system-settings/`; **U** =
`tests/unit/features/system-settings/`; **P** = the new
`U/stored-settings-parity.spec.ts`. A stored value can be inspected in its read view, an existing
disclosure, or Edit. In particular, the email/script editors expose exact text, while HTML previews
intentionally show sanitized content. A preview is not a replacement for access to the raw field.

### Customize

| Value | Actual fixture/value and visible binding | Assertion evidence |
| --- | --- | --- |
| Light logo image | `branding-light-logo`: `logo-300x80.png`; `LogoCard` → `LogoPreview` renders the returned URL at header/sign-in sizes on both surfaces. | E `branding/logos.spec.ts`, PNG preview/upload and stored-SVG cases; U `branding/branding-api.spec.ts` verifies served bytes. |
| Dark logo image | Default dark variant in `branding-light-logo`, plus custom dark upload/reset flows; independent card and URL. | E logos dark-reset case; U branding API uploads the dark variant and reads its URL. |
| Logo type | `image/png`, JPEG/GIF/SVG alternatives; stored metadata line in each card. | U `branding/LogoCard.spec.ts` checks `image/png`; E logos upload case. |
| Logo width and height | PNG `300 × 80`, JPEG `200 × 60`, GIF `120 × 40`, SVG without declared dimensions. | U LogoCard checks the PNG dimensions; E logos “accepts … and describes stored dimensions” checks alternatives. |
| Logo bytes | PNG fixture is 350 bytes; each card renders `format.bytes(sizeBytes)`, separately from dimensions. | Source binding inspected; API upload test compares exact returned file bytes. Limits/size formatting have shared and logo refusal assertions. No separate browser assertion of the literal stored “350 B” is claimed. |
| Logo default/set state | `isSet` chooses the metadata/preview or default explanation; reset refreshes the actual returned default. | E logos reset and dark-shell refresh cases. Approved limitation: API supplies no pre-deletion default URL; confirmation shows current image and restoration wording. |
| Website title | `ui-texts-custom`: `Custom title`; `#ui-text-pageTitle`, read-only name row and document title. | E `branding/ui-texts.spec.ts` partial patch sets literal `<b>Acme Mail</b>` and asserts row/title; U `branding/UiTextSection.spec.ts` preserves it during product-only edits. |
| Product name | `Custom Mail`, changed to `Acme & Co Mail`; `#ui-text-productName`, name row and signed-out shell. | E UI texts partial patch and sign-out assertions; U UiTextSection. |
| Apps heading | `Our apps`; name row and `#ui-text-appsHeading`; empty uses the classic `header.apps` placeholder/fallback. | Source binding inspected; U `branding/ui-text-draft.spec.ts` covers section patches. Existing shell/app-menu tests cover public heading consumption. |
| Login help HTML | `help-text-malicious` includes `<p>Help…</p>`, a safe contact link and refused executable markup; `#ui-text-loginHelpHtml`. | E UI texts sanitized-preview case verifies safe visible help, no executing elements and retained raw `<script>` in Edit; U HtmlFieldPreview/email sanitizer tests. |
| Announcement type | `info`, `warning`, `danger`, `null` (neutral select option); `#ui-text-announcement-type`. | E UI texts “previews every announcement type”; P loads stored `danger` without changing it during activation. |
| Announcement text | Plain text, including literal `<b>Planned outage</b>`; `#ui-text-announcement-text`, escaped banner. | P reopens inactive text, activates it with an `active`-only patch and verifies no injected `<b>`. Existing announcement/banner and UI-text tests cover active rendering. |
| Announcement active | Stored false/true; `#ui-text-announcement-active`; inactive read view explains that no banner is shown. | E UI texts disables and reloads; P reopens false and activates without losing type/text. |
| Footer HTML | `<p>Footer draft</p>`; `#ui-text-footerHtml`, sanitized preview and shell footer. | E UI texts temporary-failure, retry and conflict cases; U draft/HTML preview tests. Raw HTML remains available in Edit. |
| Hide mailbox-user login | Stored true/false; `#login-page-hideMailboxUserLogin`, labelled Yes/No read row. | P loads true and saves false without altering the other three flags. |
| Hide domain-admin login | Stored false/true; `#login-page-hideDomainAdminLogin`, labelled read row. | P checks distinct incoming false; E `sign-in-and-app-links/sign-in-page.spec.ts` concurrent edit/save and public quick links. |
| Hide admin login | Stored true/false; `#login-page-hideAdminLogin`, labelled read row. | P preserves true when unhiding mailbox login; E sign-in-page hides the public admin link. |
| Force SSO | Stored false/true; `#login-page-forceSingleSignOn`, separate section read row. | P checks preserved false; E sign-in-page saves true and checks configured/unconfigured-provider explanations. |
| App name | `App 1`…`App 3`, custom `Helpdesk`; cards/table and `#app-link-N-name`. | E `sign-in-and-app-links/app-links.spec.ts` adds, reorders and saves the complete ordered list; U AppLinkList renders literal names safely. |
| App URL | `/app-1`, `https://help.example.org`, corrected `/help`; cards/table and `#app-link-N-url`. | E app-links add/edit and URL validation; U `lib/app-link-url.spec.ts`. Relative API URLs intentionally use text inputs with URL keyboard hints. |
| App user URL | `https://help.example.org/?u=%u`, `/help?u=%u`, or null meaning the normal URL; cards/table, input and encoded preview. | E app-links asserts the admin preview and resulting Apps-menu href; U AppLinkList checks `a+b@example.org` percent encoding. |
| App hide-for-login flag | Legacy checkbox is the inverse of API `showOnLoginPage`; Yes/No cards/table plus `#app-link-N-showOnLoginPage`. | E app-links checks the Hide checkbox and exact saved `showOnLoginPage: false`; input/component tests cover inversion. |
| Built-in app rows | Same name/URL/user-URL/hide values in `BuiltInAppLinks`; includes Webmail and an immutable explanation. | E app-links built-ins case checks absence of editing controls and mobile/desktop presentation. Their values use the same read-only AppLinkList consumer. |

Colours are additional API settings, not missing classic fields: `light` and `dark` raw hex values,
effective fallback, contrast results and previews are covered in E `colours/*` and U `branding/*`.
No invented classic labels or extra sidebar destination are needed.

### Password Settings, quota and copies

| Value | Actual fixture/value and visible binding | Assertion evidence |
| --- | --- | --- |
| Minimum password length | Default 6, custom 13/10; `[data-policy-length]` and `#policy-minLength`. | P checks incoming 13; E `passwords/password-policy.spec.ts` updates 10 and checks dependent mailbox policy. |
| Require letters | P seeds false, changes to true; `#policy-requireLetters` and classic-labelled Yes/No row. | P asserts read value, checkbox and exact patch. |
| Require special characters | P seeds true, changes to false; `#policy-requireSpecialCharacters`. | P verifies a false patch is retained and other flags/length are unchanged. |
| Require mixed case | P seeds false; `#policy-requireMixedCase`. | P checks incoming read value and preservation; existing policy component/browser cases enable it and preview the rule. |
| Require digits | P seeds true; `#policy-requireDigits`. | P checks preservation; existing policy component/browser cases save it and verify downstream rule text. |
| Reset sender | `password-reset-custom`: `no-reply@example.org`; `#reset-sender` and saved sender row. | E `passwords/password-reset-email.spec.ts` validates/retries fields and preserves changed sender; U PasswordResetEmailSection and reset API tests. |
| Reset subject | `Reset your password`; `#reset-subject` and saved row. | E reset-email clears it only after explicit disable confirmation and verifies the empty PATCH/availability; U component tests. |
| Reset plain template | `Reset here: {{link}}`; `#saved-reset-textTemplate` / `#reset-textTemplate` inside TemplateField disclosure. | E reset-email restores both defaults and saves warned custom `Contact support`; U `password-reset.spec.ts` preserves the displayed counterpart. Combined read-only API smoke checks the exact returned body. |
| Reset HTML template | `<p>Reset here: <a href="{{link}}">{{link}}</a></p>`; saved/edit TemplateField and isolated preview. | E reset-email restore/missing-link/preview cases; U draft/default projection and HTML isolation tests. Combined API smoke checks exact returned HTML. |
| Reset default/availability state | `templatesAreDefault`, `passwordResetAvailable`; default badges, availability and missing-link warnings. | E reset-email defaults/disable/restore cases; not separate editable classic fields. |
| Quota sender | Projected `quota-warning@localhost`, custom `support@example.org`; saved row / `#quota-sender`. | E `quota/quota-notifications.spec.ts` custom values/restore and authoritative local-domain refusal; U quota draft tests. |
| Quota subject | Projected `Quota warning`, custom `Storage warning`; saved row / `#quota-subject`. | E quota subject-only patch checks that projected defaults are not accidentally persisted. |
| Quota HTML template | `<h1>{{username}}: {{percent}}%</h1>`; saved/edit TemplateField and preview. | E quota custom-template/default roundtrip and preview showing username/95%; shared template units. |
| Quota default state | Independent sender/subject/template flags select their default markers. | E quota checks two default-value markers and one default-template marker, removal after custom save and restoration. |
| Domain copy recipients | `IT@example.org`, `boss@example.net`, retained `retained@example.net`; `#saved-quota-copies` and `#quota-copies-recipients`. | E `quota/quota-copies.spec.ts` checks displayed saved entries, deduplication and retained data in another domain; U QuotaCopiesSection. |
| Domain copies active | True/false; labelled read state and `#quota-copies-active`. | E quota-copies checks true PATCH and the API-normalized inactive empty list. Scope/admin History checks remain in that suite. |

The actual policy order is letters, special characters, mixed case, numbers. Quota copies retain
the classic textarea; CORS below retains the classic textarea/multiple-select. Earlier proposals
for new tag editors or method checkboxes do not override these approved source-form decisions.

### Rules, maps and scripts

| Value | Actual fixture/value and visible binding | Assertion evidence |
| --- | --- | --- |
| Rule description | `rspamd-rules-30`: `Rule 01`…`Rule 30`; list and `#rule-description` on detail/create. | E `spam/rules.spec.ts` creates `Custom active rule`, verifies detail/list, and reloads a concurrent-edit result. |
| Rule content | Seeded UCL with `priority = 10` and `EXAMPLE_N`; `#rule-content`. | E rules Check/Go to line/create and preset assertions; U RuleForm and Rspamd rules API tests. |
| Rule active | Alternating active/inactive seeds; `#rule-active` and text in list/card. | E rules initial active checkbox, saved Active text and inactive filtering; U RuleForm. |
| Effective settings map | Generated content includes `additional_settings_1`; `#effective-settings-map` is read-only and selectable/copyable. | E rules effective-map retry/copy; E `polish/freshness.spec.ts` verifies refreshed generated content after an active rule save. |
| Rspamd preset title/content | API translation keys resolve to classic preset headlines; unknown-key fallback stays readable. | E rules preset case checks inserted `MAILCOW_WHITE`, explicit replacement and preserved description; U PresetPicker/preset-key. |
| Regex map identity/name | All 13 definitions in `tests/mocks/factories/regex-map.ts`; list names link to each map ID. | E `filter-maps/filter-maps.spec.ts` verifies 13 lightweight summaries and detail fetch; no content is expected in the summary response. |
| Regex map content | `# Existing patterns\n/old.example/i\n` on available fixture maps; detail CodeEditor. | E filter-maps reads/edits/checks/reviews exact line changes, preserves conflict drafts and saves with If-Match; U regex API/line tests. |
| Regex map availability | `monitoring_nolog.map` unavailable; vanished-file behavior preserves the edit. | E filter-maps unavailable/vanished tests. This replaces the classic silent-success behavior. |
| Global prefilter script | `keep;\n`, custom `# My pre-filter\nkeep;`; prefilter-specific CodeEditor. | E `global-sieve/global-sieve.spec.ts` validates line errors, retains both independent drafts and exercises saved/restart outcomes; U GlobalSieveFilterForm. |
| Global postfilter script | `require "fileinto";\nfileinto "Junk";\n`, custom `# My post-filter\nkeep;`; separate postfilter CodeEditor. | E global-sieve checks retained postfilter draft separately from prefilter; global-filter API tests preserve the other script. |
| Mailbox Sieve presets | Eight classic-labelled examples; existing mailbox filter create form, not a new settings page. | E `spam/sieve-presets.spec.ts` checks all eight choices, inserted script and preserved description/type under replacement; role-specific cases remain there. |
| Rspamd password | Empty write-only secret control with show/hide and capability minimum; no existing password is fetched or displayed. | E `server/rspamd-web-interface.spec.ts` and U RspamdWebInterfacePage check validation, secret clearing, outcome/retry and storage absence. |
| Rspamd repeat password | Separate classic repeat field retained, checked for equality before submission. | Same component/browser suites verify mismatch and accepted submission. The older one-field proposal is not implemented. |
| Rspamd UI link | Address from capabilities, not a hard-coded origin; decorative classic logo intentionally dropped. | Existing Rspamd page/API tests and source capability binding. |

The 13 map IDs are `global_mime_from_blacklist.map`, `global_mime_from_whitelist.map`,
`global_smtp_from_blacklist.map`, `global_smtp_from_whitelist.map`, `global_rcpt_blacklist.map`,
`global_rcpt_whitelist.map`, `fishy_tlds.map`, `bad_words.map`, `bad_words_de.map`,
`bad_languages.map`, `bulk_header.map`, `bad_header.map`, `monitoring_nolog.map`.

Map change review replaces the old remembered “I will be careful!” gate; script Check/Validate
and explicit save remain available. Global Sieve has the approved restart choice. None of these
changes removes a stored script/map value.

### Integrations and System mails

| Value | Actual fixture/value and visible binding | Assertion evidence |
| --- | --- | --- |
| CORS origins | Custom `https://portal.example.org`, `*`; invalid retained `old.example.org`; origins textarea and `[data-cors-value]`. | E `server/cors.spec.ts` asserts normalized save, reload and correction of stored invalid hosts. Empty uses returned server origin. |
| CORS methods | POST, GET, DELETE, PUT in classic order; selected subset POST/GET, native multiple-select. | E CORS checks option order and exact selected PATCH; U CorsPage covers the stored form. |
| IP-check enabled | False/true checkbox with the complete classic marked-up explanation; `[data-ip-check-value]`. | U IpCheckPage checks No→Yes, exact `<strong>` values and dependent addresses invalidation; E navigation foundation covers the route/save. |
| GUID | 64-character `a…a` fixture; `[data-license-guid]`, Copy GUID. | E `server/license.spec.ts` checks exact string and clipboard output without automatic verification. |
| GUID validity/result | Valid, invalid, never verified, unreachable; explicit text, no icon-only meaning. | E License state cases and U LicenseResult. |
| Customer ID | `customer-123`; classic-labelled result row. | E License complete-result assertion. |
| Service ID | `service-456`; classic-labelled result row. | E License complete-result assertion. |
| Support level | 2, including explicit zero handling in the consumer; result row. | E License complete-result assertion; U LicenseResult covers absent values and result presentation. |
| Last verification time | `2026-10-20T10:00:00Z`; formatted `<time datetime>` when supplied. | Source `<time :datetime>` binding inspected; U LicenseResult verifies that absent dates are omitted. No direct positive timestamp assertion is claimed. API-only detail, not a replacement classic setting. |
| Mail sender | Capability-suggested `noreply@mail.example.org`, custom `noreply@localhost` refusal; `#mass-sender`. | E `mass-mail/compose.spec.ts` asserts confirmation sender; E validation checks refused stored draft/visible field; U compose API/component tests. |
| Mail subject | `Maintenance notice`, custom `Draft notice`; `#mass-subject` and confirmation. | E compose confirmation; E `polish/storage-and-secrets.spec.ts` and U useMassMailCompose verify ephemeral draft handling. |
| Plain body | `Mail service maintenance starts tonight.` / `Preserve this body`; `#mass-textBody`. | E compose enters/sends; E validation asserts retained exact body after refusal; U mass-mail request/selection tests. |
| Optional HTML body | `htmlBody` CodeEditor, empty means no HTML; scriptless preview uses the existing email boundary. | U mass-mail validation checks the HTML byte limit; API/cache tests cover nullable content and lifetime. Shared email-preview isolation is tested on reset/quota consumers. Source binding keeps `htmlBody` distinct from `textBody`; no direct nonempty mass-mail HTML form-value assertion is claimed. |
| Include/exclude mode and entries | Include or exclude choice, pasted/searched mailbox entries, refused indexed entries; RecipientSelection. | E compose unknown-entry/selection-change case; E validation mixed selection/message errors; U selection and composer tests preserve the selected list only. |
| Domain limit | All receiving mailboxes or selected domains; domain picker and recipient preview. | U selection tests normalize/scope domains; E compose preview checks the receiving-only count and pagination/search. Added capability, not a dropped classic field. |
| Activation and send | Final current-count confirmation replaces activation checkbox; expectedRecipients sent with the message. | E compose requires one explicit confirmation before the job and count-change case requires a new one; U useMassMailCompose. No real mail is sent by this audit. |

License vendor links remain verbatim through the sanitizer, as resolved by the later CORS/License
checkpoint. System mails intentionally drops the external HTML-to-text converter link and adds
recipient preview/jobs. New job fields/statuses/outcomes are covered by E `mass-mail/jobs.spec.ts`
and `edges.spec.ts`; they have no classic stored-value counterpart to include in the parity ratio.

## Findings and bounded validation

No product correction was needed. Three new functional component checks fill actual value-binding
holes in the previous assertions:

1. Custom policy data independently displays letters/special/mixed-case/digit flags, then saves
   both a true and a false change while preserving the other rules and length.
2. Custom login flags display true/false/true and preserve the other roles and SSO when mailbox
   login is unhidden. The exact false PATCH and published public configuration are checked.
3. An inactive danger announcement reopens with its exact literal text and activates with only
   `announcement.active` changed; the returned read view renders text without interpreting HTML.

These **3/3** component tests pass against the existing implementation and contract-validated
mock API. Scoped ESLint, formatting and the test TypeScript project also pass. They are evidence additions, not red/green product fixes. Artifact directory:
`storage/app/restart-2026-10-20/u013-settings-parity/` in the API workspace. No browser, production
build, real API write, service restart or mail job is required for this test/document-only change.

This closes the missing inventory/reconciliation work. The tables distinguish direct assertions
from inspected bindings, such as the literal stored-logo byte count. They do not claim that every
scalar has a separate three-browser assertion or that the frozen broad gate has completed; that
gate remains the release runner's evidence. Existing cs/sk English fallbacks still await human
wording review. T174 should be assessed against this combined inventory and per-story evidence,
not an absent old filename or a nonexistent seventeenth navigation page.
