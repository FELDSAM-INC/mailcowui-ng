# Data Model: System Settings

**Feature**: `specs/013-system-settings` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

This app owns no persistent data. This document defines:

- the API data this feature consumes, as generated types;
- the app-defined models (the settings catalogue, drafts, previews, the compose draft);
- the server-state cache (query keys, freshness, invalidation);
- client state and device storage (nothing new is stored);
- the state machines of section editing, logos, map saves, Sieve saves, mass mail and the job
  refresh;
- the route map, the list address parameters, the translation keys, the client-side validation,
  the catalogue and the audit mapping.

Decisions are justified in [research.md](./research.md). Contract shapes are not restated: types
come from `src/api/generated/schema.ts` through `@/api` (001-R7).

## 1. API data consumed

Generated root types, imported from `@/api`.

| Type(s) | Operation(s) | Used by |
|---|---|---|
| `SettingsCapabilities`, `SettingsLimits` | `getSettingsCapabilities` | layout, every form's limits, demo mode, License visibility, mass mail sender, Rspamd link |
| `LogoSetting` | `getLogoSetting`, `replaceLogo`, `deleteLogo` | Logos page |
| `UiTexts`, `UiTextsAnnouncement`, `UiTextsPatch` | `getUiTexts`, `updateUiTexts` | UI texts page |
| `LoginPageSettings`, `LoginPageSettingsPatch`, `LoginPageOptions` | `getLoginPageSettings`, `updateLoginPageSettings` | Sign-in page |
| `AppLinkSettings`, `AppLinkSettingsEntry`, `AppLinkSettingsPatch`, `AppLink` | `getAppLinkSettings`, `updateAppLinkSettings` | App links page |
| `BrandColors`, `BrandColorsPatch`, `EffectiveBrandColors`, `EffectiveBrandColor` | `getBrandColors`, `updateBrandColors` | Colours page |
| `PublicConfig` (`brandColors`, `logos`, `externalIdentityProvider`), `Logo` | `getPublicConfig`, `getPublicConfigLogo` (as `<img src>`) | shell colours, logo defaults, force-SSO note, freshness |
| `IpCheckSetting`, `IpCheckSettingPatch` | `getIpCheckSetting`, `updateIpCheckSetting` | IP check page |
| `PasswordPolicy`, `PasswordPolicyPatch` | `getPasswordPolicy` (API 003), `updatePasswordPolicy` | Password policy page |
| `PasswordResetNotification`, `PasswordResetNotificationPatch` | `getPasswordResetNotification`, `updatePasswordResetNotification` | Password reset e-mail page |
| `QuotaNotificationSettings`, `QuotaNotificationSettingsPatch` | `getQuotaNotificationSettings`, `updateQuotaNotificationSettings` | Quota notifications page |
| `QuotaNotificationRecipients`, `QuotaNotificationRecipientsPatch` | `getQuotaNotificationRecipients`, `updateQuotaNotificationRecipients` | quota copies section on UI 002's domain page |
| `RspamdSettingsRule`, `RspamdSettingsRuleCreateRequest`, `RspamdSettingsRulePatch`, `SettingsValidationResult` | `listRspamdSettingsRules`, `createRspamdSettingsRule`, `getRspamdSettingsRule`, `updateRspamdSettingsRule`, `deleteRspamdSettingsRule` | rule list, rule pages |
| `RspamdEffectiveSettingsMap` | `getEffectiveRspamdSettingsMap` | effective settings map page |
| `RspamdRegexMap`, `RspamdRegexMapReplaceRequest` | `listRspamdRegexMaps`, `getRspamdRegexMap`, `replaceRspamdRegexMap` | filter map list and pages |
| `RspamdUiPasswordRequest` | `setRspamdUiPassword` | Rspamd web interface page |
| `GlobalSieveFilter`, `GlobalSieveFilterReplaceRequest`, `DovecotRestartOutcome` | `listGlobalSieveFilters`, `replaceGlobalSieveFilter` | Global Sieve filters page |
| `Preset` | `listPresets` (`rspamd`, `sieve`) | new-rule page, UI 005's create-filter form |
| `LegacyApiCorsSettings`, `LegacyApiCorsSettingsPatch` | `getLegacyApiCorsSettings`, `updateLegacyApiCorsSettings` | CORS page |
| `LicenseStatus` | `getLicenseStatus`, `verifyLicense` | License page |
| `MassMailSelection`, `MassMailPreviewRequest`, `MassMailPreviewRecipient` | `previewMassMailRecipients` | compose page |
| `MassMailJob`, `MassMailJobStatus`, `MassMailJobCreateRequest`, `MassMailRecipientCounts`, `AccountRef` | `listMassMailJobs`, `createMassMailJob`, `getMassMailJob`, `cancelMassMailJob` | compose, jobs list, job page |
| `MassMailRecipient`, `MassMailRecipientOutcome` | `listMassMailJobRecipients` | job page |
| `MassMailRecipientCountProblem`, `MassMailRunningProblem`, `ContainerProblem`, `ValidationProblem`, `FieldViolation`, `ValidationRuleCode`, `KnownProblemType` | errors | `ApiProblem`, i18n |
| `Domain` | `listDomains` (API 002) | domain picker |
| `Mailbox`, `MailboxStatus` | `listMailboxes` (API 003) | mailbox picker |
| `AuditEvent`, `Type` (aliased `AuditTargetType`), `AuditEventType`, `AuditFailureReason` | `listAuditEvents` (filters by API 002) | History, audit labels |
| `Identity` | `getIdentity` | role checks, refresh after `forbidden` |

Not used: `getGlobalSieveFilter` (the list returns both scripts with their `etag`s).

## 2. App-defined models

These are not API shapes. Each is derived from API data or app constants.

### SettingsPage and SettingsGroup (`src/features/system-settings/catalogue.ts`)

| Field | Type | Rule |
|---|---|---|
| `group.id` | `'branding' \| 'passwords' \| 'notifications' \| 'spam-filtering' \| 'mail-filtering' \| 'integrations' \| 'mass-mail'` | FR-004 order |
| `page.id` | string literal union (§10) | unique |
| `page.routeName` | route name (§6) | must resolve |
| `page.titleKey`, `page.descriptionKey` | i18n keys | `systemSettings.pages.<id>.title` / `.description` |
| `page.sections[]` | `{ id, headingKey, fieldKeys[] }` | `id` equals the heading's DOM id in the page (unit-checked) |
| `page.legacyNameKeys[]` | i18n keys | legacy names, searched in the current language and in en-gb |
| `page.auditTarget` | `{ type: AuditTargetType }` | History (§11) |
| `page.visible` | `(caps: SettingsCapabilities) => boolean` | `false` only for `license` without license verification |

### SearchEntry and SearchResult (`src/features/system-settings/search.ts`)

- `SearchEntry`: `{ pageId, sectionId?, kind: 'title' | 'section' | 'field' | 'description' | 'legacy',
  text, normalised }`, one per haystack. Rebuilt when the locale or capabilities change.
- `normalise(s, locale)`: `toLocaleLowerCase(locale)` → NFD → remove `\p{M}` → collapse whitespace.
- `SearchResult`: `{ pageId, sectionId?, rank }`, grouped by page; rank order per research R6.

### SectionEditState (`useSettingsSection`)

| Field | Meaning |
|---|---|
| `mode` | `view`, `editing`, `saving`, `outdated` |
| `draft` | the section's editable values |
| `baseEtag` | the `etag` the draft was based on |
| `changedSinceRead` | after a 412: field → `{ saved }`, the value now stored |
| `problem` | the last `ApiProblem` (field errors through `useProblemForm`) |
| `dirty` | computed: `toPatch(draft)` has at least one member |

### ContrastEvaluation (`src/shared/color/contrast.ts`)

`{ input, normalised (#rrggbb | null), formatValid, ratio, ratioLabel, minimum, passes, surface,
foreground ('#000000' | '#ffffff'), adjusted (#rrggbb | null) }`. `ratioLabel` follows research R13
(one decimal; a failing ratio never shows the minimum).

### ThemePreview (Colours page)

`{ theme: 'light' | 'dark', color | null, foreground | null, source: 'own' | 'lightFallback' |
'default' }`; `lightFallback` applies the API rule of FR-031 for a dark theme without a dark colour.

### LogoCandidate (`useLogoCandidate`)

`{ file, detectedType ('image/png' | 'image/jpeg' | 'image/gif' | 'image/svg+xml' | null), sizeBytes,
width | null, height | null, objectUrl, problems: ('unsupportedType' | 'tooLarge' |
'dimensionsExceeded')[] }`. `objectUrl` is revoked on cancel, upload and unmount.

### LineMark (`CodeEditor`)

`{ line (1-based), message (translated), source: 'live' | 'server' }`. Live marks come from
`lib/regex-lines.ts`; server marks from `invalidRegexLine`, `unbalancedStructure` and `sieveSyntax`
errors.

### MapChange (`lib/line-diff.ts`)

`{ added: string[], removed: string[] }` from a multiset comparison of lines (trailing whitespace
kept, the final empty line ignored).

### AppLinkDraft (App links page)

`AppLinkSettingsEntry` plus a client-only `key` for list rendering and reordering; `key` is never
sent.

### ComposeDraft (`useMassMailCompose`, component memory only)

| Field | Type | Maps to |
|---|---|---|
| `scope` | `'all' \| 'domains'` | `selection.domains` empty or set |
| `domains` | `string[]` | `selection.domains` |
| `listMode` | `'none' \| 'include' \| 'exclude'` | which of `selection.include` / `exclude` is sent |
| `mailboxes` | `string[]` | `selection.include` or `selection.exclude` |
| `sender`, `subject`, `textBody`, `htmlBody` | strings | request members (`htmlBody` empty → `null`) |
| `selectionKey` | computed | stable JSON of the normalised selection; changes discard the preview |
| `confirmedCount` | `number \| null` | `expectedRecipients` |
| `entryErrors` | path → `FieldViolation[]` | marks on picker chips |

### EmailPreviewInput (`EmailHtmlPreview`)

`{ kind: 'passwordReset' | 'quota' | 'massMail', html, hostname, locale }`; the sample values come
from `lib/email-samples.ts`.

### PresetView (`PresetPicker`)

`{ id, headline, content }`, where `headline` is the translation of
`systemSettings.presets.<translationKey with "." replaced by "_">` when it exists, otherwise the
API's English `headline`.

## 3. Server-state cache

### Query keys (added to `src/api/query/keys.ts`)

| Key | Operation | staleTime | Notes |
|---|---|---|---|
| `['system-settings','capabilities']` | `getSettingsCapabilities` | 5 min | invalidated after `demo-mode` and `feature-disabled` refusals |
| `['system-settings','logo',variant]` | `getLogoSetting` | 30 s | |
| `['system-settings','ui-texts']` | `getUiTexts` | 30 s | |
| `['system-settings','login-page']` | `getLoginPageSettings` | 30 s | |
| `['system-settings','app-links']` | `getAppLinkSettings` | 30 s | |
| `['system-settings','brand-colors']` | `getBrandColors` | 30 s | |
| `['system-settings','ip-check']` | `getIpCheckSetting` | 30 s | |
| the password-policy key of UI 003 (expected `['password-policy']`) | `getPasswordPolicy` | 30 s | shared with UI 003, 005 and 007 |
| `['system-settings','password-reset-notification']` | `getPasswordResetNotification` | 30 s | |
| `['system-settings','quota-notification']` | `getQuotaNotificationSettings` | 30 s | |
| `['quota-notification-recipients',domain]` | `getQuotaNotificationRecipients` | 30 s | domain page section |
| `['rspamd-rules','list',params]` | `listRspamdSettingsRules` | 30 s | params from the address (§7) |
| `['rspamd-rules','detail',ruleId]` | `getRspamdSettingsRule` | 30 s | |
| `['rspamd-settings-map']` | `getEffectiveRspamdSettingsMap` | 30 s | invalidated after every rule change |
| `['rspamd-regex-maps','list',params]` | `listRspamdRegexMaps` | 30 s | |
| `['rspamd-regex-maps','detail',mapId]` | `getRspamdRegexMap` | 30 s | seeded from the list entry |
| `['global-sieve-filters']` | `listGlobalSieveFilters` | 30 s | |
| `['presets',kind]` | `listPresets` (`limit=100`) | 1 h | shipped files |
| `['legacy-api-cors']` | `getLegacyApiCorsSettings` | 30 s | |
| `['license']` | `getLicenseStatus` | 30 s | only when verification is enabled |
| `['mass-mail-jobs','list',params]` | `listMassMailJobs` | 30 s | |
| `['mass-mail-jobs','running']` | `listMassMailJobs?status=running&limit=1` | 30 s | banner |
| `['mass-mail-jobs','detail',jobId]` | `getMassMailJob` | 0 | `refetchInterval` per research R23 |
| `['mass-mail-jobs','recipients',jobId,params]` | `listMassMailJobRecipients` | 30 s | |
| `['mass-mail-preview',selectionKey,{q,limit,offset}]` | `previewMassMailRecipients` | 0, `gcTime` 0 | transient, memory only |
| `['domains','picker',{q}]` | `listDomains` (infinite) | 30 s | distinct from UI 002's list keys (infinite data shape) |
| `['mailboxes','picker',{q,domain,status}]` | `listMailboxes` (infinite, `status=active,loginDisabled`) | 30 s | `MailboxSearchPicker`'s key (UI 008) with this feature's filters |

### Invalidation after mutations

| Mutation | On success | On 412 or conflict |
|---|---|---|
| `replaceLogo` | write the variant; invalidate `['public-config']` | refetch the variant; mark changed; ask to retry |
| `deleteLogo` | invalidate the variant and `['public-config']` | refetch; confirm the deletion again |
| `updateUiTexts`, `updateLoginPageSettings`, `updateAppLinkSettings`, `updateBrandColors` | write the resource; invalidate `['public-config']` | research R9 step 4 |
| `updateIpCheckSetting` | write the resource; invalidate UI 011's public-address query if present | R9 |
| `updatePasswordPolicy` | write the password-policy key | R9 |
| `updatePasswordResetNotification`, `updateQuotaNotificationSettings`, `updateLegacyApiCorsSettings` | write the resource | R9 |
| `updateQuotaNotificationRecipients` | write `['quota-notification-recipients',domain]` | R9; `404` → "domain no longer available" |
| `createRspamdSettingsRule` | write the detail; invalidate the list and `['rspamd-settings-map']`; navigate to the rule | — |
| `updateRspamdSettingsRule` | write the detail; invalidate the list and the map | refetch; mark; retry |
| `deleteRspamdSettingsRule` | remove the detail; invalidate the list and the map; navigate to the list | refetch; confirm again |
| `replaceRspamdRegexMap` | write the detail; invalidate the list | refetch; mark; retry; `409` unavailable → message |
| `replaceGlobalSieveFilter` | replace the entry in `['global-sieve-filters']` | refetch; mark; retry; `409` unavailable → message |
| `setRspamdUiPassword` | called on the `api` client directly, never through TanStack Query; nothing cached (secrets rule of `docs/conventions.md`) | — |
| `verifyLicense` | write `['license']` | — |
| `createMassMailJob` | write the detail; invalidate the list and `running`; remove the preview queries | count changed → refetch the preview, confirm again; running → link |
| `cancelMassMailJob` | write the detail; invalidate the list, `running` and the job's recipients | `409` → refetch the detail |
| validate-only requests (`?validateOnly=true`) | nothing | `412` → refetch and mark, as a save |

## 4. Client state and device storage

- **No new Pinia store.** Drafts live in component state; the compose draft in
  `useMassMailCompose()`'s local refs (FR-108).
- **No new device storage key.** UI 001's storage allowlist (001 data-model §4) is unchanged; the
  storage unit test of 001 keeps failing on any other key. The editor's wrap choice is kept in
  memory for the visit.
- **No new cross-tab message.** A branding change in another tab reaches this tab on its next
  public-configuration read or page load (FR-031: other users after their next page load).
- **Never retained**: the Rspamd password (component state only, sent by a direct client call that
  bypasses every TanStack Query cache, cleared after every attempt, no form draft) and mass mail
  content (memory only, dropped after sending or leaving).

## 5. State machines

### Section editing (`useSettingsSection`)

```text
view ──Edit──► editing ──Save (dirty)──► saving ──200──► view (announce; write cache; follow-up)
  ▲              │  ▲                       │ ──412──► outdated (draft kept; changed fields marked)
  │              │  └──── fix / retry ──────┤                └─Save again──► saving
  └──Cancel──────┘ (confirm if dirty)        │ ──422──► editing (field errors, summary focused)
                                             │ ──403 demo-mode──► editing (read-only notice; caps refetched)
                                             └ ──503 / network──► editing ("nothing was changed", retry)
```

Opening another section or leaving the page while `dirty` asks for confirmation (leaving through
UI 002's `useLeaveGuard`).

### Logo candidate (`useLogoCandidate`)

```text
idle ─choose file→ checking (sniff type, size, raster dimensions)
  ├─ problems → refused (limit stated; no Upload) ─choose again→ checking
  └─ ok → ready (previews from objectUrl) ─Upload→ uploading ─200→ stored (announce; caps unchanged)
                                │ Cancel → idle (revoke URL)        └─422/412/403→ ready + message
```

### Filter map save

```text
editing (live marks) ─Check→ checking ─200→ editing ("valid" announced) | ─422→ editing (server marks)
editing ─Save→ reviewing (added/removed lines) ─Confirm→ saving ─200→ saved (Rspamd reloads note)
                    └─Cancel→ editing              ├─412→ outdated ─Save again→ reviewing
                                                   ├─409 regex-map-unavailable→ editing (message)
                                                   └─422→ editing (server marks)
```

### Global Sieve filter save

```text
editing ─Check→ checking ─→ editing (result)
editing ─Save→ choosing (Restart now ● / At next restart ○; empty-script note)
          └─Confirm→ saving ─200→ outcome done | failed | deferred (announced)
                       ├─412→ outdated   ├─409→ unavailable message   └─422→ marks
```

### Mass mail compose and send

```text
recipients ─Next→ message ─Next→ preview ─(count > 0) Send→ confirming ─"Send to N mailboxes"→ sending
   ▲  selection change discards preview      │ count = 0: sending unavailable
   │                                          sending ─201→ job page
   │                                          ├─409 count changed→ preview (new N) → confirming
   │                                          ├─409 already running→ message + link to the job
   └──────────────────────────────────────────┴─422 selection.*.i→ recipients (chips marked)
```

On wide screens the four states are sections of one page, and "Preview recipients" requests the
preview from the preview section.

### Running job refresh (`useJobRefresh`)

```text
                 ┌──────── Resume (or manual Refresh) ────────┐
polling (5 s) ─no interaction for min(15 min, idleTimeout)→ paused-inactive (notice; never resumes alone)
   │ ─"Pause automatic refresh"→ paused-by-user ─"Resume"→ polling
   │ ─hidden→ paused-hidden ─visible→ one refetch → polling
   └─status ≠ running→ stopped (recipients invalidated once; final announcement)
```

Interactions are tracked by the shared `useInactivity` (UI 008, promoted by UI 011); the limit is
`min(15 min, Session.idleTimeout)` (polling rule of `docs/conventions.md`).

### License verification

```text
shown(lastVerification) ─Verify now→ verifying (progress) ─200→ shown(new result; announced)
                                         ├─403 feature-disabled→ caps refetched → not-found state
                                         └─503→ shown (message; retry)
```

## 6. Route map

The base is `/ng/`. Every route below is a child of `system-settings`, has `meta.navEntry:
'system'` (administrators only, UI 001's catalogue) and renders inside `SettingsLayout`. Every
component is a lazy chunk.

| Name | Path | Title key | Component |
|---|---|---|---|
| `system-settings` | `/system` | `systemSettings.overview.title` | `pages/SettingsOverviewPage.vue` (`?q=`) |
| `system-settings-logos` | `/system/logos` | `systemSettings.pages.logos.title` | `pages/branding/LogosPage.vue` |
| `system-settings-colours` | `/system/colours` | `…colours.title` | `pages/branding/ColoursPage.vue` |
| `system-settings-ui-texts` | `/system/ui-texts` | `…ui-texts.title` | `pages/branding/UiTextsPage.vue` |
| `system-settings-sign-in-page` | `/system/sign-in-page` | `…sign-in-page.title` | `pages/branding/SignInPageSettingsPage.vue` |
| `system-settings-app-links` | `/system/app-links` | `…app-links.title` | `pages/branding/AppLinksPage.vue` |
| `system-settings-password-policy` | `/system/password-policy` | `…password-policy.title` | `pages/passwords/PasswordPolicyPage.vue` |
| `system-settings-password-reset-email` | `/system/password-reset-email` | `…password-reset-email.title` | `pages/passwords/PasswordResetEmailPage.vue` |
| `system-settings-quota-notifications` | `/system/quota-notifications` | `…quota-notifications.title` | `pages/notifications/QuotaNotificationsPage.vue` |
| `system-settings-rspamd-rules` | `/system/rspamd-rules` | `…rspamd-rules.title` | `pages/spam/RspamdRulesPage.vue` |
| `system-settings-rspamd-rule-create` | `/system/rspamd-rules/new` | `systemSettings.rspamdRules.create.title` | `pages/spam/RspamdRuleCreatePage.vue` |
| `system-settings-rspamd-settings-map` | `/system/rspamd-rules/effective-map` | `systemSettings.rspamdRules.effectiveMap.title` | `pages/spam/EffectiveSettingsMapPage.vue` |
| `system-settings-rspamd-rule` | `/system/rspamd-rules/:ruleId(\\d+)` | `systemSettings.rspamdRules.detail.title` | `pages/spam/RspamdRuleDetailPage.vue` |
| `system-settings-filter-maps` | `/system/filter-maps` | `…filter-maps.title` | `pages/spam/FilterMapsPage.vue` |
| `system-settings-filter-map` | `/system/filter-maps/:mapId([A-Za-z0-9_.-]{1,128})` | `systemSettings.filterMaps.detail.title` | `pages/spam/FilterMapPage.vue` |
| `system-settings-rspamd-web-interface` | `/system/rspamd-web-interface` | `…rspamd-web-interface.title` | `pages/spam/RspamdWebInterfacePage.vue` |
| `system-settings-global-sieve-filters` | `/system/global-sieve-filters` | `…global-sieve-filters.title` | `pages/mail-filtering/GlobalSieveFiltersPage.vue` |
| `system-settings-cors` | `/system/cors` | `…cors.title` | `pages/integrations/CorsPage.vue` |
| `system-settings-ip-check` | `/system/ip-check` | `…ip-check.title` | `pages/integrations/IpCheckPage.vue` |
| `system-settings-license` | `/system/license` | `…license.title` | `pages/integrations/LicensePage.vue` |
| `system-settings-mass-mail-send` | `/system/mass-mail/send` | `…mass-mail-send.title` | `pages/mass-mail/MassMailSendPage.vue` |
| `system-settings-mass-mail-jobs` | `/system/mass-mail/jobs` | `…mass-mail-jobs.title` | `pages/mass-mail/MassMailJobsPage.vue` |
| `system-settings-mass-mail-job` | `/system/mass-mail/jobs/:jobId([0-9A-HJKMNP-TV-Z]{26})` | `systemSettings.massMail.job.title` | `pages/mass-mail/MassMailJobPage.vue` |

Rules:

- Search results open a page with a `#<sectionId>` hash; the router focus module focuses that
  heading (research R6).
- A rule, map or job that the API answers `404` for renders `SettingsNotFoundState` with a link to
  its list (FR-006). `/system/license` renders the same state while license verification is
  disabled. Any other unknown `/system/...` address falls to UI 001's catch-all not-found page.
- Domain administrators and mailbox users see UI 001's `NoAccessState` on every route above, and no
  query runs (FR-001), because `ShellLayout` checks the catalogue before mounting the route.

## 7. List address parameters (`useListState` schemas)

Defaults are omitted from the address; invalid values fall back and are normalised with
`router.replace` (001 data-model §5).

**Overview** (`/system`): `q` (string ≤ 100) only; not a paged list.

**Settings rules** (`/system/rspamd-rules`, FR-054):

| Param | Type | Default | Maps to |
|---|---|---|---|
| `q` | string ≤ 255 | — | `q` (description and content) |
| `active` | `true`, `false` | — | `active` |
| `sort` | `id`, `description`, `active`, `createdAt`, `modifiedAt` | `id` | `sort` |
| `order` | `asc`, `desc` | `asc` | `order` |
| `page`, `size` | integer ≥ 1; 25, 50, 100 | 1, 25 | `offset`, `limit` |

**Filter maps** (`/system/filter-maps`, FR-063): `q` (name), `page`, `size`; no `sort` (the
operator's order).

**Mass mail jobs** (`/system/mass-mail/jobs`, FR-087): `q` (subject), `status` (`running`,
`completed`, `cancelled`), `page`, `size`; sort fixed to `createdAt desc`.

**Job recipients** (`/system/mass-mail/jobs/:jobId`, FR-088): `q` (address), `outcome` (`pending`,
`delivered`, `failed`, `skipped`), `page`, `size`; sort fixed to `address asc`.

**Recipient preview** (compose page): `q`, page and size in component state (research R22), 25 per
page.

## 8. Translation keys

New keys are hand-written in `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`; reused legacy keys are
mapped in `src/i18n/legacy-map.json`.

| Key group | Content |
|---|---|
| `systemSettings.overview.*`, `systemSettings.groups.<id>`, `systemSettings.pages.<id>.{title,description}` | overview, groups, pages |
| `systemSettings.sections.<page>.<section>`, `systemSettings.fields.<page>.<field>` | section headings and field labels (also the search haystacks) |
| `systemSettings.legacyNames.<name>` | legacy names never translated by legacy ("Rspamd UI", "Prefilter", "Postfilter"), same text in all locales |
| `systemSettings.search.*` | search label, result count (plural), no results, clear |
| `systemSettings.common.*` | edit, save, cancel, discard, default badge, empty meanings, demo-mode notice, outdated notice, unsaved-changes confirmation, history, not found, copy |
| `systemSettings.logos.*`, `.colours.*`, `.uiTexts.*`, `.signInPage.*`, `.appLinks.*` | branding pages |
| `systemSettings.passwordPolicy.*`, `.passwordReset.*` | password pages (policy rules reuse `admin.password_policy_*`) |
| `systemSettings.quota.*`, `.quotaCopies.*` | quota notifications and copies |
| `systemSettings.rspamdRules.*`, `.filterMaps.*`, `.rspamdUi.*`, `.globalSieve.*` | spam and mail filtering |
| `systemSettings.cors.*`, `.ipCheck.*`, `.license.*` | integrations |
| `systemSettings.massMail.*` | compose, preview, confirmation (plural "Send to {count} mailboxes"), jobs, statuses, outcomes, failure labels |
| `systemSettings.presets.admin_rsettings_preset_<n>`, `systemSettings.presets.mailbox_sieve_preset_<n>` | legacy preset headlines |
| `codeEditor.*`, `emailPreview.*`, `tagEditor.*` (additions) | shared components |
| `problem.<name>` | `demo-mode`, `feature-disabled`, `regex-map-unavailable`, `global-sieve-filter-unavailable`, `mass-mail-already-running`, `mass-mail-recipient-count-changed`, `container-action-failed`, `outcome-unknown`, `temporary-failure` (specific wording for this feature where it differs) |
| `validation.<code>` | `unsupportedImageType`, `invalidImage`, `imageDimensionsExceeded`, `unsafeSvgContent`, `insufficientContrast`, `invalidRegexLine`, `unbalancedStructure`, `mutuallyExclusive`, `tooFew`, `sieveSyntax` |
| `validation.format.<format>` | `email`, `singleLine`, `appLinkUrl`, `hexColor`, `origin` |
| `validation.params.construct.<v>` | `scriptElement`, `eventHandlerAttribute`, `scriptUrl`, `foreignContent`, `externalReference`, `styleImport`, `doctype`, `notWellFormed`, `rootNotSvg`, `unclosedBrace`, `unexpectedBrace`, `unclosedBracket`, `unexpectedBracket`, `unclosedString` |
| `validation.params.reason.<v>` | `notSlashDelimited`, `tooManyFlags`, `innerSlash`, `doesNotCompile`, `notReceiving`, `outsideSelectedDomains` |
| `auditLog.events.<type>`, `auditLog.targets.<type>`, `auditLog.failureReasons.<reason>`, `auditLog.details.systemSettings.*` | §11 |

Reused legacy keys (meaning unchanged, from the spec's Assumptions) include `admin.customize`,
`admin.change_logo`, `admin.logo_normal_label`, `admin.logo_dark_label`, `admin.upload`,
`admin.ip_check`, `admin.login_page`, `admin.quicklink_text`, `admin.user_quicklink`,
`admin.domainadmin_quicklink`, `admin.admin_quicklink`, `admin.app_links`, `admin.app_name`,
`admin.link`, `admin.user_link`, `admin.app_hide`, `admin.ui_texts`,
`admin.ui_header_announcement`, `admin.ui_header_announcement_type*`,
`admin.ui_header_announcement_help`, `admin.password_policy*`, `admin.password_length`,
`admin.password_reset_settings`, `admin.password_reset_tmpl_text`, `admin.password_reset_tmpl_html`,
`admin.password_settings`, `admin.quota_notifications`, `admin.quota_notifications_info`,
`admin.quota_notification_sender`, `admin.quota_notification_subject`,
`admin.rspamd_settings_map`, `admin.active_rspamd_settings_map`, `admin.rsetting_*`,
`admin.rsettings_preset_*`, `admin.rspamd_global_filters`, `admin.rspamd_global_filters_info`,
`admin.regex_maps`, `admin.cors_settings`, `admin.allowed_origins`, `admin.allowed_methods`,
`admin.sys_mails`, `admin.includes`, `admin.excludes`, `admin.guid_and_license`, `admin.guid`,
`admin.customer_id`, `admin.service_id`, `admin.validate_license_now`, `edit.quota_warning_bcc`,
`add.validate`, `mailbox.sieve_preset_*`, `header.apps`, `success.ui_texts`, `success.app_links`,
`success.custom_login_modified`, `success.ip_check_opt_in_modified`,
`success.password_policy_saved`, `success.rspamd_ui_pw_set`, `success.cors_headers_edited`,
`success.global_filter_written`, `success.dovecot_restart_success`, `warning.dovecot_restart_failed`,
`danger.img_size_exceeded`, `danger.img_dimensions_exceeded`, `danger.cors_invalid_origin`,
`danger.cors_invalid_method`. With `stripHtml`: `admin.ip_check_opt_in`. Not reused:
`admin.main_name`, `admin.title_name`, `admin.apps_name`, `admin.force_sso` (they name the product),
`admin.ui_header_announcement_content` (meaning changed), `admin.license_info` (vendor links),
`admin.merged_vars_hint` (technical file names), `admin.rspamd_global_filters_regex` (it points to a
restart link that this page does not have), `danger.sieve_error` (the parser message is shown by
`validation.sieveSyntax`).

## 9. Client-side validation

Checks run before submitting; server field errors are always shown too. "Caps" means
`SettingsCapabilities`.

| Field | Rule | Limit source | Message key |
|---|---|---|---|
| Page title, product name, apps heading, subjects, rule description, app link name | 1 (where required) to N characters, no line break or control character | `caps.limits.singleLineTextMaxLength` | `validation.required`, `validation.tooLong`, `validation.format.singleLine` |
| Help text, footer, announcement text | ≤ N characters | `caps.limits.htmlTextMaxLength` | `validation.tooLong` |
| Reset and quota templates | ≤ N UTF-8 bytes | `caps.limits.templateMaxBytes` | `validation.tooLong` (bytes) |
| Rule content | not empty after trimming; ≤ N bytes | `caps.limits.rspamdRuleContentMaxBytes` | `validation.required`, `validation.tooLong` |
| Map content | ≤ N bytes; live line rules of research R18 | `caps.limits.rspamdRegexMapMaxBytes` | `validation.invalidRegexLine` with `reason` |
| Sieve script | ≤ N bytes (empty allowed) | `caps.limits.sieveScriptMaxBytes` | `validation.tooLong` |
| Mass mail bodies | text required; each ≤ N bytes | `caps.massMail.maxBodyBytes` | `validation.required`, `validation.tooLong` |
| E-mail addresses (senders, copy recipients, pasted mailboxes) | `src/shared/validation/email.ts`; senders may be empty except mass mail | — | `validation.format.email` |
| Brand colour | `^#?[0-9A-Fa-f]{6}$`, normalised to `#rrggbb`; ratio ≥ minimum | `caps.brandColors.*` | `validation.format.hexColor`, `validation.insufficientContrast` |
| App link address and user link | absolute `http`/`https` URL or path with exactly one leading `/`; ≤ 2,048 characters | contract (`AppLinkSettingsEntry.url.maxLength`) | `validation.format.appLinkUrl`, `validation.tooLong` |
| App links | ≤ N entries | `caps.limits.appLinksMax` | `validation.tooMany` |
| Copy recipients | ≤ N entries, each ≤ 255 characters, unique ignoring case | `caps.limits.quotaNotificationRecipientsMax`; contract (255) | `validation.tooMany`, `validation.format.email` |
| CORS origin | `*` or `scheme://host[:port]`, `http`/`https`, nothing after the authority; lower-cased; ≤ 2,048 | contract (2,048); `caps.limits.corsOriginsMax` | `validation.format.origin`, `validation.tooMany` |
| CORS methods | at least one of GET, POST, PUT, DELETE | contract enum | `validation.required` |
| Password policy length | whole number from min to max | `caps.limits.passwordPolicyMinLength`, `passwordPolicyMaxLength` | `validation.outOfRange` |
| Rspamd password | min to max characters, no control characters | `caps.limits.rspamdUiPasswordMinLength`, `…MaxLength` | `validation.tooShort`, `validation.tooLong`, `validation.format.singleLine` |
| Logo file | detected type in `caps.logos.acceptedMediaTypes`; ≤ `maxBytes`; raster ≤ `maxWidth` × `maxHeight` | `caps.logos.*` | `validation.unsupportedImageType`, `validation.tooLong` (bytes), `validation.imageDimensionsExceeded` |
| Selection lists | each ≤ N entries; include and exclude never both | `caps.massMail.maxSelectionEntries` | `validation.tooMany` |

`src/shared/validation/limits.ts` gains the contract-only constants (2,048 for app link addresses and
CORS origins, 255 for copy recipient entries), each checked against `contract/openapi.json` by its
unit test (001 data-model §6).

## 10. Settings catalogue

In this order (FR-004). "Legacy names" are searched in the current language and in en-gb.

| Page id | Group | Path | Sections (ids) | Legacy names | Audit target | Visible |
|---|---|---|---|---|---|---|
| `logos` | branding | `/system/logos` | `light-logo`, `dark-logo`, `logo-guidance` | `admin.customize`, `admin.change_logo` | `logo` | always |
| `colours` | branding | `/system/colours` | `brand-colours`, `colour-preview` | `admin.customize` | `brandColors` | always |
| `ui-texts` | branding | `/system/ui-texts` | `names`, `login-help`, `footer`, `announcement` | `admin.customize`, `admin.ui_texts`, `admin.ui_header_announcement` | `uiTexts` | always |
| `sign-in-page` | branding | `/system/sign-in-page` | `sign-in-links`, `single-sign-on` | `admin.customize`, `admin.login_page` | `loginPage` | always |
| `app-links` | branding | `/system/app-links` | `custom-links`, `built-in-links` | `admin.customize`, `admin.app_links` | `appLinks` | always |
| `password-policy` | passwords | `/system/password-policy` | `policy`, `policy-rules` | `admin.password_settings`, `admin.password_policy` | `passwordPolicy` | always |
| `password-reset-email` | passwords | `/system/password-reset-email` | `availability`, `sender`, `templates`, `placeholders` | `admin.password_settings`, `admin.password_reset_settings` | `passwordResetNotification` | always |
| `quota-notifications` | notifications | `/system/quota-notifications` | `notification-email`, `notification-template`, `copies` | `admin.quota_notifications`, `edit.quota_warning_bcc` | `quotaNotification` | always |
| `rspamd-rules` | spam-filtering | `/system/rspamd-rules` | `rules`, `effective-map` | `admin.rspamd_settings_map`, `admin.active_rspamd_settings_map` | `rspamdSettingsRule` | always |
| `filter-maps` | spam-filtering | `/system/filter-maps` | `maps`, `format` | `admin.rspamd_global_filters`, `admin.regex_maps` | `rspamdRegexMap` | always |
| `rspamd-web-interface` | spam-filtering | `/system/rspamd-web-interface` | `password`, `web-interface` | `systemSettings.legacyNames.rspamdUi` | `rspamdUiPassword` | always |
| `global-sieve-filters` | mail-filtering | `/system/global-sieve-filters` | `prefilter`, `postfilter` | `systemSettings.legacyNames.prefilter`, `systemSettings.legacyNames.postfilter`, `mailbox.filters` | `globalSieveFilter` | always |
| `cors` | integrations | `/system/cors` | `origins`, `methods` | `admin.cors_settings` | `legacyApiCors` | always |
| `ip-check` | integrations | `/system/ip-check` | `opt-in` | `admin.ip_check` | `ipCheck` | always |
| `license` | integrations | `/system/license` | `guid`, `verification` | `admin.guid_and_license` | `license` | `caps.licenseVerificationEnabled` |
| `mass-mail-send` | mass-mail | `/system/mass-mail/send` | `recipients`, `message`, `preview`, `send` | `admin.sys_mails` | `massMailJob` | always |
| `mass-mail-jobs` | mass-mail | `/system/mass-mail/jobs` | `jobs` | `admin.sys_mails` | `massMailJob` | always |

Field labels per section are listed in `catalogue.ts`; for example `ui-texts › announcement` has
`announcementText`, `announcementType`, `announcementActive`, and `cors › origins` has
`allowedOrigins`.

## 11. Audit events and targets

History links use `targetType` (and `targetId` where shown). Labels go to
`auditLog.events.<type>` and `auditLog.targets.<type>`; details are formatted by
`src/features/audit-log/details/system-settings.ts`.

| Event type | Target type | Target ID (History) | Details shown |
|---|---|---|---|
| `logoReplacement`, `logoDeletion` | `logo` | — (page), `light`/`dark` in the entry | old and new type, dimensions, binary size |
| `uiTextsUpdate` | `uiTexts` | — | plain fields old → new; help text, footer, announcement text as "changed" with old and new size; footer migration |
| `loginPageUpdate` | `loginPage` | — | flags old → new |
| `appLinksUpdate` | `appLinks` | — | old and new lists (names and addresses as text) |
| `brandColorsUpdate` | `brandColors` | — | light and dark old → new with swatches |
| `ipCheckUpdate` | `ipCheck` | — | on/off old → new |
| `passwordPolicyUpdate` | `passwordPolicy` | — | values old → new |
| `passwordResetNotificationUpdate` | `passwordResetNotification` | — | sender, subject old → new; templates as "changed" with sizes |
| `quotaNotificationUpdate` | `quotaNotification` | — | sender, subject old → new; template as "changed" with sizes |
| `quotaNotificationRecipientsUpdate` | `quotaNotificationRecipients` | domain | recipients old → new; active |
| `rspamdSettingsRuleCreation`, `…Update`, `…Deletion` | `rspamdSettingsRule` | rule ID | description, active old → new; content as "changed" with sizes |
| `rspamdRegexMapReplacement` | `rspamdRegexMap` | map file name | old and new size |
| `globalSieveFilterReplacement` | `globalSieveFilter` | — (page), `prefilter`/`postfilter` in the entry | old and new size; restart outcome |
| `rspamdUiPasswordChange` | `rspamdUiPassword` | — | "password changed"; Rspamd confirmed or not; never a value |
| `legacyApiCorsUpdate` | `legacyApiCors` | — | origins and methods old → new |
| `massMailJobCreation`, `massMailJobCompletion`, `massMailJobCancellation` | `massMailJob` | job ID | sender, subject, selection summary, recipient count; counts per outcome |
| `licenseVerification` | `license` | — | result |

New failure reasons labelled: `demoMode`, `featureDisabled`, `fileUnavailable`, `serviceFailure`,
`outcomeUnknown`. Unknown detail keys use UI 001's generic details list.
