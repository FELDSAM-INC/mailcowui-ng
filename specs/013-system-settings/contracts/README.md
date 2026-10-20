# Contracts of UI feature 013

This app exposes no API of its own. Its only interface is the mailcow-rest-v2 contract it consumes
(constitution I), vendored in `contract/` and pinned as UI 001 describes
([001 contracts](../../001-sign-in-app-shell/contracts/README.md)). This file records the pin that
013 needs and the operations, problems and rule codes it uses.

## Pinned contract

| Field | Value |
|---|---|
| API repository | `FELDSAM-INC/mailcow-rest-v2` |
| API feature | 013 – system settings (plus the operations of 001, 002 and 003 listed below) |
| Contract version (`info.version`) | `0.1.0` (does not identify a contract, 001-R6) |
| UI013 implementation pin | `dd9a44e` / `dd9a44ec76b39d6aaaceacbb9512409494a19cdb` |
| UI013 bundle sha256 | `d7a259a5cda61863deccfa8a98622caaf499a0f2eb81118f0cca63ba6f06edd6` |
| Pin ancestry verified | Includes both `32079252` and preceding UI pin `4be8653` |
| Planning baseline (authoritative minimum) | commit `32079252d55797d3da4e58ae661e9fb91c51c6f9` (2026-10-18, "Register KnownProblemType in contract components") |
| Bundle sha256 at the baseline | `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6` (`@redocly/cli@2.64.1 bundle api/openapi.yaml`) |
| Paths / operations at the baseline | 250 / 376 |
| API 013 contract | 45 operations (44 in the modules `settings-server`, `settings-branding`, `settings-password`, `settings-quota-notifications`, `settings-rspamd`, `settings-global-filters`, `presets`, `mass-mail`, `license`; `updatePasswordPolicy` in 003's `password-policy` module) |

The bump task (T001 in [tasks.md](../tasks.md)) runs `scripts/contract/bump.sh` with the ref that is
current when 013 starts, or with a release tag that contains the API 013 contract. That ref must
contain the baseline commit, because UI 001–012 will already have pinned later refs. The bump then
regenerates the client, and `tests/unit/api/system-settings-operations.spec.ts` asserts that every
operation in the table below exists with its method, path and documented statuses. If an operation
differs, the plan is re-aligned before implementation continues; the UI never works around a
contract change (constitution I).

At the baseline, `KnownProblemType` is listed under `components.schemas`, so
`knownProblemTypeValues` is generated (UI 001's API gap 5 is closed).

## Operations used by this feature

### API 013 (44 of 45)

| operationId | Method and path | Used by | Requirements |
|---|---|---|---|
| `getSettingsCapabilities` | GET `/capabilities/settings` | settings layout, limits, demo mode, License visibility | FR-017, FR-020, FR-023, FR-032, FR-033, FR-073, FR-082 |
| `getLogoSetting` | GET `/settings/logos/{variant}` | Logos page | FR-018 |
| `replaceLogo` | PUT `/settings/logos/{variant}` (raw image body) | Logos page | FR-020, FR-021 |
| `deleteLogo` | DELETE `/settings/logos/{variant}` | Logos page | FR-022 |
| `getUiTexts` | GET `/settings/ui-texts` | UI texts page | FR-034 |
| `updateUiTexts` | PATCH `/settings/ui-texts` | UI texts page | FR-034 to FR-037 |
| `getLoginPageSettings` | GET `/settings/login-page` | Sign-in page | FR-038 |
| `updateLoginPageSettings` | PATCH `/settings/login-page` | Sign-in page | FR-038 |
| `getAppLinkSettings` | GET `/settings/app-links` | App links page | FR-039 |
| `updateAppLinkSettings` | PATCH `/settings/app-links` | App links page | FR-040, FR-041 |
| `getBrandColors` | GET `/settings/brand-colors` | Colours page | FR-024 to FR-027 |
| `updateBrandColors` | PATCH `/settings/brand-colors` | Colours page | FR-024 to FR-029 |
| `getIpCheckSetting` | GET `/settings/ip-check` | IP check page | FR-042 |
| `updateIpCheckSetting` | PATCH `/settings/ip-check` | IP check page | FR-042 |
| `updatePasswordPolicy` | PATCH `/password-policy` | Password policy page | FR-043, FR-044 |
| `getPasswordResetNotification` | GET `/settings/password-reset-notification` | Password reset e-mail page | FR-045, FR-046 |
| `updatePasswordResetNotification` | PATCH `/settings/password-reset-notification` | Password reset e-mail page | FR-045 to FR-048 |
| `getQuotaNotificationSettings` | GET `/settings/quota-notification` | Quota notifications page | FR-049 |
| `updateQuotaNotificationSettings` | PATCH `/settings/quota-notification` | Quota notifications page | FR-049 |
| `getQuotaNotificationRecipients` | GET `/domains/{domain}/quota-notification-recipients` | quota copies section (UI 002 domain page) | FR-051 |
| `updateQuotaNotificationRecipients` | PATCH `/domains/{domain}/quota-notification-recipients` | quota copies section | FR-052, FR-053 |
| `listRspamdSettingsRules` | GET `/settings/rspamd-rules` | rule list | FR-054 |
| `createRspamdSettingsRule` | POST `/settings/rspamd-rules` (also `validateOnly=true`) | new-rule page | FR-055, FR-056, FR-058 |
| `getRspamdSettingsRule` | GET `/settings/rspamd-rules/{ruleId}` | rule page | FR-057 |
| `updateRspamdSettingsRule` | PATCH `/settings/rspamd-rules/{ruleId}` (also `validateOnly=true`) | rule page | FR-057, FR-058 |
| `deleteRspamdSettingsRule` | DELETE `/settings/rspamd-rules/{ruleId}` | rule page | FR-057, FR-059 |
| `getEffectiveRspamdSettingsMap` | GET `/settings/rspamd-settings-map` | effective settings map page | FR-060 |
| `listRspamdRegexMaps` | GET `/settings/rspamd-regex-maps` | filter map list (seeds map pages) | FR-063 |
| `getRspamdRegexMap` | GET `/settings/rspamd-regex-maps/{mapId}` | map page opened by address | FR-064 |
| `replaceRspamdRegexMap` | PUT `/settings/rspamd-regex-maps/{mapId}` (also `validateOnly=true`) | map page | FR-065 to FR-067 |
| `setRspamdUiPassword` | PUT `/settings/rspamd-ui-password` | Rspamd web interface page | FR-073, FR-074 |
| `listGlobalSieveFilters` | GET `/settings/global-sieve-filters` | Global Sieve filters page | FR-068 |
| `replaceGlobalSieveFilter` | PUT `/settings/global-sieve-filters/{filterId}` (also `validateOnly=true`) | Global Sieve filters page | FR-069 to FR-071 |
| `listPresets` | GET `/presets/{presetKind}` | new-rule page (`rspamd`), UI 005 create-filter form (`sieve`) | FR-056, FR-061, FR-062 |
| `getLegacyApiCorsSettings` | GET `/settings/legacy-api-cors` | CORS page | FR-075, FR-076 |
| `updateLegacyApiCorsSettings` | PATCH `/settings/legacy-api-cors` | CORS page | FR-075, FR-076 |
| `previewMassMailRecipients` | POST `/mass-mail-jobs/recipient-preview` | compose page | FR-083 |
| `createMassMailJob` | POST `/mass-mail-jobs` | compose page | FR-084 to FR-086 |
| `listMassMailJobs` | GET `/mass-mail-jobs` | jobs list, running banner | FR-087 |
| `getMassMailJob` | GET `/mass-mail-jobs/{jobId}` | job page (refresh) | FR-088 |
| `listMassMailJobRecipients` | GET `/mass-mail-jobs/{jobId}/recipients` | job page | FR-088 |
| `cancelMassMailJob` | POST `/mass-mail-jobs/{jobId}/cancellation` | job page | FR-089 |
| `getLicenseStatus` | GET `/license` | License page | FR-077 |
| `verifyLicense` | POST `/license/verification` | License page | FR-078, FR-079 |

Not used: `getGlobalSieveFilter` (`listGlobalSieveFilters` returns both scripts with their version
tags).

### Operations of earlier features

| operationId | Method and path | Feature | Used by |
|---|---|---|---|
| `getPasswordPolicy` | GET `/password-policy` | API 003 | Password policy page (shares the version tag with `updatePasswordPolicy`) |
| `getPublicConfig` | GET `/public-config` | API 001 | shell brand colours (`brandColors`), logo defaults, force-SSO note (`externalIdentityProvider`), refetched after branding saves |
| `getPublicConfigLogo` | GET `/public-config/logos/{variant}` | API 001 | `<img src>` only, from `LogoSetting.url` and `Logo.url` |
| `listAuditEvents` | GET `/audit-events` (`targetType`, `targetId`) | API 001, filters by API 002 | History |
| `getIdentity` | GET `/me` | API 001 | role checks; refresh after `forbidden` |
| `listDomains` | GET `/domains` (`q`, paging) | API 002 | mass mail domain picker |
| `listMailboxes` | GET `/mailboxes` (`q`, `status`, `domain`, paging) | API 003 | mass mail mailbox picker |

## Request details that the client must get right

- **Merge patches**: every settings PATCH sends `Content-Type: application/merge-patch+json` with only
  the changed members (lists whole), plus `If-Match` with the `etag` that was read.
- **Logo upload**: the raw file as the body with its detected media type (`image/png`, `image/jpeg`,
  `image/gif`, `image/svg+xml`) or `application/octet-stream`; `openapi-fetch` gets
  `bodySerializer: (file) => file`. Validation errors come on the key `body`.
- **Validate-only**: `?validateOnly=true` on `createRspamdSettingsRule`, `updateRspamdSettingsRule`,
  `replaceRspamdRegexMap` and `replaceGlobalSieveFilter` answers `200 {"data":{"valid":true}}` or
  the same `422` as a real request; `If-Match` is checked too.
- **Global Sieve save**: `deferRestart: true` for "Apply at the next restart"; the outcome is
  `meta.dovecotRestart.outcome` (`done`, `failed`, `deferred`).
- **Mass mail**: `expectedRecipients` is the preview's `meta.recipientCount`; `htmlBody` is `null`
  when empty; the preview's `q`, `limit` and `offset` are query parameters of the POST.
- **Session-only operations**: `createMassMailJob`, `cancelMassMailJob` and `setRspamdUiPassword`
  are refused for API keys (`session-required`); the app always uses the session, so this is
  handled only as a generic message.

## Problem types and the app's response

Messages come from `problem.<name>` and `validation.<code>`, never from `title`, `detail` or
`message`.

| `type` (`/api/v2/problems/…`) | Status | Operations | App behaviour |
|---|---|---|---|
| `about:blank` | 412 | every PATCH, PUT and DELETE with `If-Match`, validate-only requests | Keep input, reload, mark changed values, save again or discard; deletions confirmed again (FR-011) |
| `temporary-failure` | 503 | settings reads and writes, effective map, license | "Nothing was changed"; retry keeps input; reads show the error state with retry |
| `demo-mode` | 403 | logo, UI texts, login page, app links, brand colours, IP check writes | Read-only notice, input kept, capabilities read again (FR-017) |
| `feature-disabled` | 403 | `getLicenseStatus`, `verifyLicense` | Capabilities read again; License "not found" state (FR-079) |
| `regex-map-unavailable` | 409 | `replaceRspamdRegexMap` | "Not available on this server; nothing changed" (FR-067) |
| `global-sieve-filter-unavailable` | 409 | `replaceGlobalSieveFilter` | "Not available on this server; nothing saved or restarted" (FR-071) |
| `container-action-failed` (`container: rspamd-mailcow`) | 502 | `setRspamdUiPassword` | "Could not be confirmed; may apply at Rspamd's next start"; retry (FR-074) |
| `outcome-unknown` (`step: rspamdUiPassword`) | 504 | `setRspamdUiPassword` | "Unknown whether it was set; setting it again is safe"; retry |
| `mass-mail-recipient-count-changed` (`actualRecipients`) | 409 | `createMassMailJob` | Fresh preview with the new count; confirm again (FR-085) |
| `mass-mail-already-running` (`runningJobId`) | 409 | `createMassMailJob` | Message with a link to the running job (FR-085) |
| `about:blank` | 409 | `cancelMassMailJob` | "The job already completed"; show its final state (FR-089) |
| `validation-failed` | 422 | writes, previews, lists | Field errors on fields, entries or editor lines; error summary (FR-012) |
| `about:blank` | 404 | rule, map, job, domain recipients | "Not found" state with a way back (FR-006), UI 002's for a domain |
| `forbidden` | 403 | any | Translated reason; identity refreshed (FR-003) |
| `session-required` | 403 | session-only operations | Generic message advising to sign in again |
| `insufficient-key-scope`, `pending-action-required`, `csrf-token-mismatch` | 403 | any | UI 001's handling (001-R8) |

## Validation rule codes of this feature

| Code | Parameters | Shown on |
|---|---|---|
| `unsupportedImageType` | `allowed` | logo file panel (`body`) |
| `invalidImage` | — | logo file panel |
| `imageDimensionsExceeded` | `maxWidth`, `maxHeight`, `width`, `height` | logo file panel |
| `unsafeSvgContent` | `construct`, `line` | logo file panel |
| `tooLong` with `unit: bytes` | `max` | logo panel, editors, templates, bodies |
| `insufficientContrast` | `ratio`, `minimum`, `surface` | colour field (FR-028) |
| `invalidFormat` | `format`: `email`, `singleLine`, `appLinkUrl`, `hexColor`, `origin` | the field or entry |
| `outOfRange` | `min`, `max` | password policy length |
| `invalidRegexLine` | `line`, `reason` (`notSlashDelimited`, `tooManyFlags`, `innerSlash`, `doesNotCompile`) | map editor line |
| `unbalancedStructure` | `line`, `construct` | rule editor line |
| `sieveSyntax` | `message` (parser's English message, quoted), `line` | Sieve editor line |
| `notFound`, `notEligible` (`reason`: `notReceiving`, `outsideSelectedDomains`) | — | mass mail selection chip |
| `mutuallyExclusive` | `with` | selection (cannot occur from the form; generic) |
| `tooFew` | `min` | selection without recipients |
| `tooMany` | `max` | app links, copy recipients, origins, selection lists |
| `required`, `tooShort` | `min` | any field |

Unknown codes are shown as a generic invalid value of that field (FR-092).
