# Contracts of UI feature 006

This app exposes no API of its own. Its only interface is the mailcow-rest-v2 contract it
consumes (constitution I). That contract is not duplicated here. This file records:

- which contract version this feature needs;
- which operations it uses;
- which problem types and rule codes it handles;
- which enumerations it must label.

Vendoring and client generation are unchanged from
[UI 001's contracts README](../../001-sign-in-app-shell/contracts/README.md).

## Pinned contract

| Field | Value |
|---|---|
| API repository | `FELDSAM-INC/mailcow-rest-v2` |
| API feature | 006: quarantine, spam policy and rate limits (spec `mailcow-rest-v2/specs/006-quarantine-spam-policy/spec.md`) |
| Contract modules | `api/modules/quarantine/`, `api/modules/spam-policy/`, `api/modules/rate-limits/`, and the `Quarantine*`, `SpamPolicy*`, `SpamScore*`, `SpamFilter*` and `RateLimit*` components |
| Contract version (`info.version`) | `0.1.0` (does not identify the contract, 001-R6) |
| Baseline commit (authoritative) | `32079252d55797d3da4e58ae661e9fb91c51c6f9` (2026-10-18, "Register KnownProblemType in contract components") |
| Bundle | `@redocly/cli@2.64.1 bundle api/openapi.yaml` (single file, not dereferenced) |
| Bundle sha256 at the baseline | `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6` |
| Operations in the bundle | 376 (42 of them API 006) |

**Bump rule** (research R1): the setup task runs `scripts/contract/bump.sh` with the **later** of
this baseline and the commit UI 005 pinned. It never moves the pin backwards. If the kept commit is
later than the baseline, it diffs the three 006 modules and the 006 components between the two
commits, and updates this file before implementation continues. `contract/VERSION.json` is
authoritative after the bump.

**Effects of this pin**:

- `KnownProblemType` is listed under `components.schemas`, so `knownProblemTypeValues` is generated.
  This closes UI 001's API gap 5.
- `permission-flag-required` documents `requiredFlagsMatch` (`all` or `any`).
- The translation check requires keys for every enumeration value in the bundle (research R2).

## Operations used by this feature

### API feature 006 (38 of 42)

| operationId | Method and path | Used by | Requirements |
|---|---|---|---|
| `getQuarantineCapabilities` | GET `/capabilities/quarantine` | every form and list (limits, page sizes, frames, release formats) | conventions "Capabilities"; R8 |
| `listQuarantineItems` | GET `/quarantine` | quarantine list | FR-008 to FR-017 |
| `getQuarantineItem` | GET `/quarantine/{itemId}` | item page; busy re-check; re-read after a lost response | FR-018 to FR-023, FR-030 |
| `releaseQuarantineItem` | POST `/quarantine/{itemId}/release` | "Deliver to inbox" (`learnAsHam` true or false) | FR-026, FR-029 |
| `learnQuarantineItemAsSpam` | POST `/quarantine/{itemId}/spam-learning` | "Learn as spam and delete" | FR-027, FR-029 |
| `deleteQuarantineItem` | DELETE `/quarantine/{itemId}` | "Remove" | FR-028 |
| `applyQuarantineBulkAction` | POST `/quarantine/bulk-actions` | bulk deliver (with or without learning), learn, remove | FR-032 to FR-035 |
| `downloadQuarantineMessage` | GET `/quarantine/{itemId}/message` | "Download (.eml)" | FR-036 to FR-038 |
| `downloadQuarantineAttachment` | GET `/quarantine/{itemId}/attachments/{position}` | attachment download | FR-036 to FR-038 |
| `getQuarantineSettings` | GET `/quarantine/settings` | status notice (public subset), settings page | FR-008, FR-059 |
| `updateQuarantineSettings` | PATCH `/quarantine/settings` | settings sections (merge patch, `If-Match`; `validateOnly` not used) | FR-060 to FR-064 |
| `getMailboxQuarantineNotificationSettings` | GET `/mailboxes/{mailbox}/quarantine-notification-settings` | Notifications page; mailbox page | FR-039 |
| `updateMailboxQuarantineNotificationSettings` | PATCH `/mailboxes/{mailbox}/quarantine-notification-settings` | notification panel | FR-040 |
| `applyQuarantineNotificationBulkAction` | POST `/quarantine-notification-settings/bulk-actions` | mailbox list bulk actions (UI 003) | FR-041 |
| `getMailboxSpamScore` | GET `/mailboxes/{mailbox}/spam-score` | spam score panel | FR-042 |
| `setMailboxSpamScore` | PUT `/mailboxes/{mailbox}/spam-score` | spam score save | FR-043 |
| `resetMailboxSpamScore` | DELETE `/mailboxes/{mailbox}/spam-score` | "Reset to server default" | FR-044 |
| `listDomainSpamPolicyEntries` | GET `/domains/{domain}/spam-policy-entries` | lists panel (domain page) | FR-045 to FR-047 |
| `createDomainSpamPolicyEntry` | POST `/domains/{domain}/spam-policy-entries` | add entry | FR-048, FR-049 |
| `deleteDomainSpamPolicyEntry` | DELETE `/domains/{domain}/spam-policy-entries/{entryId}` | remove entry (single and one by one) | FR-050 |
| `listAliasDomainSpamPolicyEntries` | GET `/alias-domains/{aliasDomain}/spam-policy-entries` | lists panel (alias domain page) | FR-045 to FR-047 |
| `createAliasDomainSpamPolicyEntry` | POST `/alias-domains/{aliasDomain}/spam-policy-entries` | add entry | FR-048, FR-049 |
| `deleteAliasDomainSpamPolicyEntry` | DELETE `/alias-domains/{aliasDomain}/spam-policy-entries/{entryId}` | remove entry | FR-050 |
| `listMailboxSpamPolicyEntries` | GET `/mailboxes/{mailbox}/spam-policy-entries` | lists panel (Spam filter page, mailbox page) | FR-045 to FR-047 |
| `createMailboxSpamPolicyEntry` | POST `/mailboxes/{mailbox}/spam-policy-entries` | add entry | FR-048, FR-049 |
| `deleteMailboxSpamPolicyEntry` | DELETE `/mailboxes/{mailbox}/spam-policy-entries/{entryId}` | remove entry | FR-050 |
| `getSpamFilterActionStatistics` | GET `/spam-filter-action-statistics` | statistics page | FR-065 |
| `listRateLimits` | GET `/rate-limits` | Rate limits overview | FR-056 |
| `getDomainRateLimit` | GET `/domains/{domain}/rate-limit` | rate limit panel (domain) | FR-052 |
| `setDomainRateLimit` | PUT `/domains/{domain}/rate-limit` | set limit | FR-053 |
| `removeDomainRateLimit` | DELETE `/domains/{domain}/rate-limit` | "Remove limit" | FR-054 |
| `getAliasDomainRateLimit` | GET `/alias-domains/{aliasDomain}/rate-limit` | rate limit panel (alias domain) | FR-052 |
| `setAliasDomainRateLimit` | PUT `/alias-domains/{aliasDomain}/rate-limit` | set limit | FR-053 |
| `removeAliasDomainRateLimit` | DELETE `/alias-domains/{aliasDomain}/rate-limit` | "Remove limit" | FR-054 |
| `getMailboxRateLimit` | GET `/mailboxes/{mailbox}/rate-limit` | rate limit panel (mailbox, with effective limit) | FR-052 |
| `setMailboxRateLimit` | PUT `/mailboxes/{mailbox}/rate-limit` | set limit | FR-053 |
| `removeMailboxRateLimit` | DELETE `/mailboxes/{mailbox}/rate-limit` | "Remove limit" | FR-054 |
| `resetRateLimitBucket` | DELETE `/rate-limit-buckets/{bucketId}` | "Reset a rate-limit bucket" (overview); exported for UI 011 | FR-058 |

**Not used** (research R3):

- `previewQuarantineTemplate`, and the `validateOnly` parameter. Spec FR-063 says the template is
  never previewed; see owner question 1 in the plan.
- `getDomainSpamPolicyEntry`, `getAliasDomainSpamPolicyEntry` and `getMailboxSpamPolicyEntry`.
  List entries carry everything, including `etag`.

### Other features' operations (read only)

| operationId | Method and path | Used by | Requirement |
|---|---|---|---|
| `getIdentity` (API 001) | GET `/me` | permissions; a domain administrator's domain filter (`scope.domains`); refresh after refusals | FR-002 to FR-004, FR-013 |
| `listAuditEvents` (API 001, target filters from API 002) | GET `/audit-events` | History (`targetType`, `targetId`) | FR-066 |
| `listDomains` (API 002) | GET `/domains` | an administrator's domain filter; excluded domains picker; "Set a rate limit" | FR-013, FR-057, FR-062 |
| `listAliasDomains` (API 004) | GET `/alias-domains` | excluded domains picker; "Set a rate limit" | FR-057, FR-062 |
| `listMailboxes` (API 003) | GET `/mailboxes` | "Set a rate limit" (mailbox) | FR-057 |
| `getMailbox` (API 003) | GET `/mailboxes/{mailbox}` | the recipient link check on the item page (`404` for resources and deleted mailboxes) | FR-006 |

## Problem types and the app's response

Messages come from `problem.<name>` and the extension members, never from `title` or `detail`
(FR-067). The shared types of UI 001 (`unauthenticated`, `csrf-token-mismatch`,
`pending-action-required`, `insufficient-key-scope` and the others) keep their 001 behaviour.

| `type` (`/api/v2/problems/…`) | Status | Where | App behaviour |
|---|---|---|---|
| `quarantine-item-busy` | 409 (`Retry-After`) | item actions, downloads; bulk item `refused` | "Another action is in progress for this item." Re-read the item once after `Retry-After` (default 5 s); never resend (FR-030) |
| `quarantine-delivery-refused` | 409 | release; bulk item `refused` | Item kept; show `smtpCode` and `smtpResponse` as plain text (FR-030) |
| `quarantine-message-too-large` | 409 | downloads | "Too large to download" with `size` and `limit` as binary sizes (FR-038) |
| `spam-policy-entry-exists` | 409 | add entry | "Already on the Allowlist/Denylist" per `list`, naming the pattern sent (FR-049) |
| `temporary-failure` | 503 (`Retry-After`) | actions, settings, rate limits, bucket reset, statistics; bulk item `failed` | "Nothing was changed", naming `dependency` (shared store, spam filter, mail server) and `step`; retry on request (FR-030, FR-070). Statistics: "temporarily unavailable" with retry (FR-065) |
| `permission-flag-required` | 403 | every flag-gated write; downloads; bulk as a whole | Names `requiredFlags` by legacy label, joined per `requiredFlagsMatch`; refreshes the identity and the data; updates the controls (FR-004) |
| `attribute-not-permitted` | 403 | notification settings (mailbox user) | Marks each attribute in `attributes` read-only with its flag; refreshes the identity (FR-004) |
| `forbidden` | 403 | role never allowed (for example a domain administrator and the settings) | "No permission" in context (001-R8) |
| `validation-failed` | 422 | forms; bulk over the limit (`targets`: `tooMany`) | Field errors plus summary (FR-068); rule codes below |
| `about:blank` 404 | 404 | any object or item | Item: "already released or removed", back to the list. Page read: the "not found" page. Entry removal: "already removed". Bucket: "nothing to reset" |
| `about:blank` 412 | 412 | versioned writes | Input kept, reload, changed values marked, save again or discard (FR-069). A refused reset or removal is confirmed again |
| `about:blank` 400 | 400 | malformed request | Generic message with the request ID (001 FR-077) |

## Validation rule codes handled

From `ValidationRuleCode` and its feature 006 description:

| Code | Params | Fields |
|---|---|---|
| `outOfRange` | `min`, `max` | scores, rate limit value, retention, maximum age |
| `notMultipleOf` | `factor` (`0.1`, `1048576`) | scores, maximum message size |
| `mustNotExceed` | `field`, `value` | `junkScore` |
| `invalidFormat` | `format`: `email`, `domainName`, `senderPattern` | sender and recipients, excluded domains, patterns |
| `tooLong` | `max`, optional `unit: bytes` | pattern, subject, template |
| `tooMany` | `max` | bulk `targets` |
| `notFound` | — | `excludedDomains.<n>` |
| `notInList` | `allowed` | rate limit `frame`, release format, frequency, category |
| `invalidTemplate` | `reason` (`syntax`, `security`, `render`, `timeout`), `line` | `notificationTemplate` |
| `required`, `invalidType` | as 001 | any |

Any other code shows as a generic invalid value of its field (001-R15).

## Enumerations that need labels

Every value needs an en-gb, cs-cz and sk-sk label, checked by `npm run i18n:check` (research R2):

- `AuditEventType`: the 12 values of 006;
- `AuditTarget.type`: the 7 values of 006;
- `QuarantineItemAction`, `QuarantineNotificationFrequency`, `QuarantineNotificationCategory`,
  `QuarantineReleaseFormat`, `SpamPolicyList` and `SpamPolicyOwner.kind`;
- `RateLimitObjectKind`, `RateLimitValue.frame` and `RateLimit.effectiveSource`;
- `QuarantineActionReport.{action,delivery,learning,fuzzy}`,
  `QuarantineItemDetails.contentStatus` and `QuarantineRecipient.source`;
- `SpamFilterTemporaryFailureProblem.{dependency,step}`;
- `BulkItemOutcome` (from UI 002);
- the `invalidTemplate` reasons, and the `format` values `email`, `domainName` and
  `senderPattern`.

## Downloads

`downloadQuarantineMessage` and `downloadQuarantineAttachment` answer `200` with a binary body and
four required headers:

- `Content-Disposition: attachment` with `filename` and an RFC 8187 `filename*`;
- `X-Content-Type-Options: nosniff`;
- `Content-Security-Policy: default-src 'none'; sandbox`;
- `Cache-Control: private, no-store`.

The mock returns exactly these, and the validator checks them. The app reads the body as a blob and
saves it as `application/octet-stream` (research R10).
