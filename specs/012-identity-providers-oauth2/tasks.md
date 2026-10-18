---
description: "Task list for UI feature 012: identity providers and OAuth2"
---

# Tasks: Identity Providers and OAuth2

**Input**: Design documents from `specs/012-identity-providers-oauth2/`:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/README.md](./contracts/README.md)
- [quickstart.md](./quickstart.md)

**Prerequisites**:
- **UI features 001 to 011 are implemented.** This feature extends UI 001's sign-in screen,
  session machinery, audit log, mock API and test fixtures, and reuses the shared building blocks
  that UI 002, 003, 005, 010 and 011 build (plan, "Dependencies on earlier UI features").
- **mailcow-rest-v2 feature 012 is implemented**: its `tasks.md` is complete and its quickstart
  Part A passes (research R1, UI 002 D1 policy). Its contract has been merged since the planning
  baseline `3207925`. The end-to-end suite runs against the contract-validated mock; the smoke
  tasks run against the API's dev stack.

**Tests**: Mandatory (constitution VI, test-first). In every phase, the mock handlers and scenarios
come first, then tests that must fail, then the implementation. Every end-to-end spec:
- runs on `mobile-chromium` (360 px), `desktop-chromium` and `mobile-webkit`;
- calls `expectAccessible` (axe, WCAG 2.2 AA, both themes) on every screen and state it reaches,
  except the fake provider page, which is not part of the app;
- calls `expectNoHorizontalScroll` at 360 and 320 px and `expectTouchTargets` on the mobile
  projects;
- fails on any CSP violation or mock contract violation (UI 001 fixtures);
- names its spec reference in the test title (`US2-AS4 …`, `FR-046 …`, `SC-011 …`, `Edge: …`).

**Organization**: tasks are grouped by user story (spec priorities P1 to P3), so that each story
can be implemented and tested on its own once the foundation is in place.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1 to US6)
- Paths are relative to the repository root `mailcowui-ng/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Make sure the pinned contract contains API 012 and that every building block borrowed
from earlier UI features exists (research R1), and extend the tooling.

- [X] T001 *(done: pinned at mailcow-rest-v2 `33f1eea` (main after `fc79902`), bundle sha256 `c4dfc9f9…a7e43f`; the API 012 files differ from the baseline only by G42 (`renewSecret`, `Oauth2ClientBulkResult`) and G20 (`If-None-Match: *` on the first save, which closes API gap 3); typecheck and unit tests clean after the bump)* Pin the contract that implements API 012 (research R1, [contracts/README.md](./contracts/README.md) "Rule for T001"):
  1. Confirm that mailcow-rest-v2 feature 012 is implemented (its `tasks.md` complete, its quickstart Part A passing).
  2. Diff the API 012 contract files listed in the contracts README between the baseline `32079252d55797d3da4e58ae661e9fb91c51c6f9` and the release tag (`contract-012` if it exists) or the first implementing commit. Review every difference against plan.md, data-model.md and this file before going on, and adjust them if the contract changed.
  3. Run `scripts/contract/bump.sh <tag-or-commit>`. Never pin a commit older than the one in `contract/VERSION.json`. Then run `npm run typecheck`, `npm run test:unit` and `npm run test:e2e`, and fix the fallout of the bump.
  4. Confirm that the generated file exports the API 012 root types of data-model §1 and `knownProblemTypeValues`, and record the ref, commit and bundle sha256 in the "Pin at implementation" row of `specs/012-identity-providers-oauth2/contracts/README.md`.
- [X] T002 *(done: present and passing — coverage manifest, parsed problem bodies, merge-patch section saves, `EditableSection`, `changedSince`/`useVersionedSave`, `useLeaveGuard`, `ConfirmDialog` with `requireTyped`, `useBulkSelection`/`BulkActionBar`/`BulkResultSummary`, `HistoryLink` with target filters, `OneTimeSecretDialog` and `useSecretRequest` (UI 001). Not on `main` because UI 003, 005, 010 and 011 have not landed: `PasswordInput`/`CopyButton`, `CopyableValue`, `useStatusMessage`, UI 003's template query and routes, UI 011's catalogue group and Cron log. Decision: under the legacy form map only the template list is still needed, so `listMailboxTemplates` gets the canonical key `['mailbox-templates','all']` in `src/api/query/keys.ts` and the mock handler `tests/mocks/handlers/mailbox-templates.ts` (list only); the secret field's reveal toggle and the copy of the return addresses stay in the feature (one use each); outcomes are announced with `announce()` and the sections' inline status, as in UI 002)* Check the building blocks in plan.md "Dependencies on earlier UI features", one row at a time. Each must exist with the stated behaviour, and its own tests must pass:
  - `src/i18n/coverage.json` and its handling in `scripts/i18n/check.mjs` (UI 002 D2);
  - the parsed problem body on `ApiProblem` in `src/api/problem.ts`;
  - UI 002's merge-patch section saves;
  - `src/shared/components/EditableSection.vue` (driven by the `edit` query parameter, one section at a time);
  - `changedSince` in `src/shared/composables/useVersionedSave.ts`;
  - `src/shared/composables/useLeaveGuard.ts`;
  - `src/shared/components/ConfirmDialog.vue` (`requireTyped`);
  - `src/shared/composables/useBulkSelection.ts`, `src/shared/components/BulkActionBar.vue` and `src/shared/components/BulkResultSummary.vue`;
  - `src/shared/components/HistoryLink.vue`, with `targetType` and `targetId` in `src/features/audit-log/list-state.ts`;
  - `src/shared/components/OneTimeSecretDialog.vue` (room for a second copyable value, UI 005);
  - `src/shared/components/password/PasswordInput.vue` and `src/shared/components/CopyButton.vue` (UI 005);
  - `src/shared/components/CopyableValue.vue` (UI 010);
  - `src/shared/composables/useStatusMessage.ts` with `src/app/shell/StatusMessageHost.vue` (UI 011);
  - UI 003's "all templates" query in `src/features/mailboxes/templates-api.ts` (key `['mailbox-templates','all']`) and `tests/mocks/handlers/mailbox-templates.ts`;
  - UI 003's routes `mailboxes` (list parameter `source`), `mailbox-detail` and `mailbox-templates`;
  - UI 011's `group` field in `src/app/navigation/catalogue.ts` and its route `operations-log` with `logType` and the `task` parameter.

  When a block was built under another name or path, use it and correct the paths in this file and in plan.md. When a block or a listed capability is missing, build it now, test-first, at the listed path with the listed behaviour, before any story starts, and add a row for it to the plan's Complexity Tracking.
- [X] T003 *(done: the real coverage manifest must require every `IdentityProviderType` and test failure category; a fixture without a Slovak text fails. The synchronisation state and the grant types are not shown (legacy form map), so they are not required)* [P] Extend `tests/unit/scripts/i18n-tools.spec.ts` (research R26, UI 002 D2). These enumerations, which this feature introduces into the UI, join the check's **fully required** enumerations (a key for every value, outside the coverage manifest):
  - `IdentityProviderType`;
  - `IdentityProviderSynchronisation.state`;
  - `IdentityProviderConnectionTestResult.outcome` and `.failureCategory`;
  - the items of `Oauth2ClientCapabilities.grantTypes`.

  Their values come from the generated enumeration arrays where `--enum-values` emits them, and otherwise from their schema paths in `contract/openapi.json`, never from a hand-written list. Check with fixture message sets that a missing `identityProvider.sync.state.overdue` fails. The test must fail.
- [X] T004 *(done: no script change was needed: the manifest's `complete` registry (UI 002) takes `identityProvider.type` and `identityProvider.test.failure`)* Extend `scripts/i18n/check.mjs` and `scripts/i18n/lib.mjs` so that T003 passes.
- [X] T005 *(done: `SMOKE_IDP=1` starts the `idp` profile, waits for OpenLDAP with `ldapsearch` and prints the notes; `stack-down.sh` stops the profile)* [P] Extend `scripts/smoke/stack-up.sh` and `scripts/smoke/stack-down.sh` (research R25).
  - With `SMOKE_IDP=1`, `stack-up.sh` runs `docker compose --profile idp up -d` in `$MAILCOW_REST_V2_DIR` after the base stack and waits until OpenLDAP accepts connections on port 389.
  - `stack-down.sh` also stops the `idp` profile.
  - Print `idp: openldap ready` and, unless `SMOKE_SSO_USERNAME` is set, a note that the single sign-on smoke test will be skipped.

**Checkpoint**: The pin contains API 012, every borrowed building block exists, and `npm run i18n:check` knows the new enumerations.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The mock state and factories for the three API 012 modules, the request log of the
`Referer` header, the API barrel and query keys, the shared validation constants, the storage key,
and the parameter-driven validation messages that every story uses.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005a *(done: "Decisions at implementation" and "Legacy form map (T005a)" in plan.md)* Write the legacy form map for this feature's screens (screen → legacy template → field → legacy key, including messages) in `plan.md`, and use only those keys plus the minimal new strings in the implementation.
  Follow `docs/conventions.md` "Translations and forms" and the templates in plan.md "Translations and forms (constitution IV 1.3.0)"; list any deviation under "Deviations needing a decision". Every later screen task depends on it.

### Tests for the foundation (write first; must fail)

- [X] T006 *(done: 13 numeric limits and 4 patterns, compared with the contract)* [P] Extend `tests/unit/shared/validation/limits.spec.ts` (research R15). Each new constant of `src/shared/validation/limits.ts` must equal its value in `contract/openapi.json`:
  - Keycloak `realm` `maxLength` 255, `clientId` 255, `version` `maxLength` 64 with `pattern` `^[0-9]+(\.[0-9]+){0,3}$`;
  - LDAP host item `maxLength` 253, `port` `minimum` 1 and `maximum` 65535, `usernameField` `pattern` `^[A-Za-z][A-Za-z0-9-]*$`;
  - mapping `template` `maxLength` 255;
  - `SingleSignOnCompletionRequest.code` `maxLength` 4096 and `state` 512;
  - `SingleSignOnProviderErrorRequest.error` `pattern` `^[\x20-\x21\x23-\x5B\x5D-\x7E]{1,64}$`;
  - `Oauth2ClientCreateRequest.redirectUris` item `maxLength` 2000;
  - the `scopes` `pattern`.
- [X] T007 *(done)* [P] Extend `tests/unit/shared/platform/storage.spec.ts` (data-model §4). `sessionStorage` key `mailcowui-ng.sso-return-to` can be written, read and removed. Every other new key is still refused. A throwing `sessionStorage` never breaks the caller.
- [X] T008 *(done: `tests/unit/i18n/problems-identity-provider.spec.ts`; `duplicate` has one message without the entry number)* [P] Extend `tests/unit/i18n/problems.spec.ts` (research R26, FR-068). Check:
  - the six API 012 problem types (`identity-provider-not-configured`, `identity-provider-in-use`, `single-sign-on-not-available`, `sign-in-state-invalid`, `identity-provider-unavailable`, `identity-provider-session-ended`) map to `problem.<name>`, and each is in `knownProblemTypeValues`;
  - `secretRequired` with `reason` `noStoredSecret`, `typeChanged` or `addressChanged` selects `validation.secretRequiredReason.<reason>`, and an unknown reason falls back to `validation.secretRequired`;
  - `notFound` with `resource: mailboxTemplate` selects `validation.notFoundResource.mailboxTemplate`;
  - `duplicate` with `duplicateOf: attributeMapping.0.attributeValue` reads "same as entry 1";
  - `conflictsWith` with `field: importUsers` names that field's label;
  - `invalidFormat` with each format `httpUrl`, `hostName`, `keycloakRealm`, `keycloakVersion`, `scopeList`, `ldapAttribute`, `ldapFilter`, `redirectUri` and `oauthErrorCode` selects `validation.format.<format>`.
- [X] T009 *(done)* [P] Write `tests/unit/api/identity-provider-in-use.spec.ts`. `identityProviderInUseDetails(problem)` returns `{ blockingMailboxes, mailboxCounts }` for an `ApiProblem` of type `/api/v2/problems/identity-provider-in-use`, typed from the generated `IdentityProviderInUseProblem`. It returns `null` for any other type and for a body without the members.

### Mock infrastructure

- [X] T010 *(done: state for the identity provider (`MockIdentityProvider`), single sign-on (`MockSingleSignOn`), OAuth2 clients and mailbox template names, with overrides; factories `identity-provider.ts`, `oauth2-client.ts` and `mailbox-template.ts`, checked against the contract in `tests/unit/mocks/identity-provider-factories.spec.ts`; the area modules of handlers and scenarios are registered empty for the stories)* Extend `tests/mocks/scenarios/state.ts` and create factories (research R24).
  - Scenario state gains:
    - `identityProvider`: the stored configuration or `null`, its `etag` and `modifiedAt`, and the secrets kept server-side only;
    - capabilities overrides;
    - `mailboxCounts`;
    - `connectionTest` (`outcome`, a `sequence` of outcomes, `providerStatus`, `hang`);
    - `pendingSingleSignOn` (`stateHash`, `expiresAt`, `returnUrl`);
    - `singleSignOn` behaviour (`completion`: `success`, `stateInvalid`, `refused`, `unavailable` or `notAvailable`; `startNotAvailable`; `endIdpSession`);
    - provider password accounts with `source` and `providerOutage`;
    - `oauth2Clients` with secrets, token counts and `etag`;
    - the switches `rotateEtagOnNextWrite` and `removedElsewhere`.
  - Create `tests/mocks/factories/identity-provider.ts`:
    - capabilities with the API's documented defaults (`createMailboxOnSignIn` `true`, `scopes` `openid profile email mailcow_template`, `port` 389, `usernameField` `mail`, `syncInterval` 15) and limits (`attributeMappingMaxEntries` 100, `attributeValueMaxLength` 255, `additionalReturnUrlsMaxEntries` 100, `urlMaxLength` 2000, `ldapHostsMaxEntries` 10, `syncIntervalMinMinutes` 1, `syncIntervalMaxMinutes` 10080, `secretMaxLength` 1000, `scopesMaxEntries` 50, `distinguishedNameMaxLength` 1000, `filterMaxLength` 1000), `providerTimeoutSeconds` 7;
    - configurations of each type built from the generated types;
    - synchronisation states;
    - test results.
  - Create `tests/mocks/factories/oauth2-client.ts`: client IDs of 12 lowercase hexadecimal characters, secrets of 24, `etag` values and token counts.
- [X] T011 *(done: the recorder in `tests/mocks/handlers/index.ts` keeps the `referer` header, which `mockApi.requests()` returns)* Extend the request recorder in `tests/mocks/server.ts`, and `mockApi.requests()` in `tests/e2e/fixtures/mock-api.ts`, so that each recorded request also holds its `Referer` header (research R5, SC-003).

### Implementation for the foundation

- [X] T012 *(done)* [P] Add the API 012 constants of T006 to `src/shared/validation/limits.ts`, each with a comment naming its schema path, so that T006 passes.
- [X] T013 *(done: the root types, enumeration arrays, `identityProviderInUseDetails()`, and the keys `identityProvider.*`, `oauth2Clients.*` and `mailboxTemplates.*`)* Extend the API layer (research R10, R17), so that T009 passes and the typecheck stays clean.
  - `src/api/index.ts` re-exports the generated root types and enumeration arrays of data-model §1: `IdentityProvider` and its variants, `IdentityProviderInput` and its variants, `IdentityProviderPatch`, `IdentityProviderCapabilities`, `IdentityProviderConnectionTestResult`, `IdentityProviderType`, `IdentityProviderMailboxCounts`, `IdentityProviderSynchronisation`, `IdentityProviderInUseProblem`, `SingleSignOnStart`, the two single sign-on request types, `Oauth2Client`, `Oauth2ClientWithSecret`, `Oauth2ClientCapabilities`, `Oauth2ClientCreateRequest`, `Oauth2ClientPatch` and `Oauth2ClientBulkActionRequest`.
  - `src/api/problem.ts` gains `identityProviderInUseDetails()`, reading the parsed problem body that T002 confirmed.
  - `src/api/query/keys.ts` gains `identityProvider.capabilities()`, `identityProvider.configuration()`, `oauth2Clients.capabilities()`, `oauth2Clients.list(params)` and `oauth2Clients.detail(id)`, with `Oauth2ClientListParams` aliased from `NonNullable<operations['listOauth2Clients']['parameters']['query']>`.
- [X] T014 *(done)* [P] Add `sessionStorage` key `mailcowui-ng.sso-return-to` to the allowlist in `src/shared/platform/storage.ts`, so that T007 passes.
- [X] T015 *(done: after the rebase onto UI 004, `secretRequired` with `reason` and `notFound` with `resource` use UI 004's parameter lookup (`validation.byParam.<code>.<param>.<value>`; `reason` added to its discriminating parameters), and `conflictsWith` uses UI 004's message; `identity-provider-in-use` shows the legacy `danger.authsource_in_use` through `LEGACY_TEXTS`; 26 new strings, plus the 8 type and failure texts of T004)* Extend `src/i18n/problems.ts` with the parameter-driven selections of research R26, and map the API 012 problem types and rule codes to the legacy `danger.*` messages of T005a's form map (for example `identity-provider-in-use` → `danger.authsource_in_use`). Add these new strings, only where the form map has no legacy key, to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`:
  - `problem.<name>` for the API 012 types without a legacy message;
  - `validation.format.{httpUrl,hostName,keycloakRealm,keycloakVersion,scopeList,ldapAttribute,ldapFilter,redirectUri,oauthErrorCode}`;
  - `validation.secretRequiredReason.{noStoredSecret,typeChanged,addressChanged}`;
  - `validation.notFoundResource.mailboxTemplate`.

  T008 must pass, and so must `npm run i18n:check`.

**Checkpoint**: The mock can hold identity provider, single sign-on and OAuth2 state, the request log records `Referer`, and the shared constants, storage key, types and messages are ready. User stories can start.

---

## Phase 3: User Story 1 - Set up and test the identity provider (Priority: P1) 🎯 MVP

**Goal**: The Identity provider screen with its empty state, the setup flow (steps below `lg`, one
page with a section index from `lg` up), the connection test, the save, and the read-only overview
of the stored configuration, including counts, completeness, the synchronisation status and the
return addresses.

**Independent Test**: As an administrator on 360 px and desktop, set up a configuration of each type
from `idp-none`, run tests that return each result category, and save. Confirm the requests through
`mockApi.requests()` and every message. As a domain administrator and as a mailbox user, open the
address and confirm "no access" with no request.

### Tests for User Story 1 (write first; must fail)

- [X] T016 *(done: all six operations in `tests/mocks/handlers/identity-provider.ts` (with T066's change, removal and switches); scenarios `idp-none`, `idp-no-templates`, `idp-templates-fail`, `idp-ldap` and those of T066 in `tests/mocks/scenarios/identity-provider.ts`; UI 003 has not landed, so `tests/mocks/handlers/mailbox-templates.ts` serves the template list from the scenario's names (`idp-templates-many` dropped: the pickers are plain selects, as legacy); checked in `tests/unit/mocks/identity-provider-handlers.spec.ts`)* [US1] Implement the identity provider handlers in `tests/mocks/handlers/identity-provider.ts` for `getIdentityProviderCapabilities`, `getIdentityProvider`, `saveIdentityProvider` and `testIdentityProviderConnection`, and register them in `tests/mocks/handlers/index.ts` (research R24). The handlers implement:
  - `404 identity-provider-not-configured` before the first save;
  - `PUT` answering `201` with `Location` and `ETag` when creating and `200` when replacing, with `If-Match` checked (`412`);
  - `422` errors:
    - `secretRequired` with `reason: noStoredSecret` when no configuration of the type is stored;
    - `conflictsWith` (`field: type`) for members of another type;
    - `duplicate` with `duplicateOf` for repeated attribute values;
    - `notFound` with `resource: mailboxTemplate` for unknown templates;
    - `invalidFormat` for the API 012 formats;
  - the normalisations: trailing slashes removed from `serverUrl`, attribute names lower-cased, `useStartTls` false when `useSsl`, `effectivePort` 636 for SSL on 389;
  - the in-use refusal `409` with `blockingMailboxes` and `mailboxCounts` for a save of another type;
  - test outcomes from `connectionTest`: `success`, `unreachable`, `timedOut`, `tlsCertificateRejected`, `credentialsRejected`, `unexpectedResponse` with `providerStatus`, a `sequence`, and `hang` through MSW `delay('infinite')`; a test with an omitted secret is accepted only for the stored type and an unchanged address (`secretRequired` otherwise).

  Templates come from UI 003's `tests/mocks/handlers/mailbox-templates.ts` and its scenario data. Add `tests/mocks/scenarios/identity-provider.ts`, registered in `tests/mocks/scenarios/index.ts`, with:
  - `idp-none`: admin, no configuration, the templates "Students" and "Staff";
  - `idp-no-templates`;
  - `idp-templates-many`: 40 templates;
  - `idp-templates-fail`: `listMailboxTemplates` answers `500`;
  - `idp-ldap`: a complete LDAP configuration with no mailboxes and a `waiting` synchronisation.
- [X] T017 *(done: `tests/e2e/identity-provider/setup.spec.ts`, on the legacy form instead of the step flow (plan "Decisions at implementation" 3): the classic tab with Keycloak chosen, each type's fields and defaults, the two SSL/StartTLS switches, the rules with the summary, the secret, the app's return addresses with a refused clipboard, return URL and mapping entries, no templates, a failing template list, the create-only save of LDAP, Keycloak and Generic-OIDC, the leave guard, network loss and long values. Step names, type explanations, the empty state and the review step are gone with the step flow)* [P] [US1] Write `tests/e2e/identity-provider/setup.spec.ts`. It covers:
  - US1-AS1 and FR-004: the empty state explains single sign-on, provider password sign-in and automatic creation, and offers "Set up an identity provider". The `404` is not shown as an error.
  - FR-003: the loading state while the capabilities and configuration load; with a `500` on `getIdentityProvider` the error state offers a retry that recovers.
  - US1-AS2, FR-009 to FR-011, at 360 px:
    - the type step explains each type;
    - choosing LDAP shows "Step 2 of 4", choosing Keycloak "Step 2 of 5";
    - only that type's fields are shown;
    - the capabilities' defaults are prefilled: port 389, username field `mail`, sync interval 15, automatic creation on, scopes `openid profile email mailcow_template` for generic OIDC.
  - FR-073: each step change focuses the step heading and announces "Step n of m"; Back keeps every entry; the browser's Back button returns to the previous step.
  - US1-AS5 and FR-018:
    - a repeated attribute value marks the entry and blocks Next;
    - a relative server URL, a realm with `/`, a version `26.x`, 11 LDAP hosts, port 70000, a filter `(a=b` and a sync interval of 10081 are each marked at their field;
    - the error summary links to the fields.
  - FR-019: the hosts are entries with add and remove actions named after the host; the connection security is one choice; SSL with port 389 says port 636 will be used; StartTLS asks for the standard port.
  - FR-021 and FR-022: the Keycloak service account note, and "no synchronisation" for generic OIDC.
  - FR-024 and FR-026: the secret is required in setup, masked with a reveal toggle, and has `autocomplete="new-password"`.
  - US1-AS7, FR-027 and FR-028:
    - Keycloak and generic OIDC show the app's return addresses from the capabilities with copy actions and the registration explanation, next to the required classic return URL and the additional return URLs;
    - FR-076: copying announces success, and `Edge: clipboard refused` selects the address with an explanation.
  - FR-029 to FR-032: mapping cards at 360 px with remove actions named after their value; the explanations are visible; the default template offers "None".
  - `Edge: no templates` (`idp-no-templates`): the mapping says so and links to the templates screen.
  - `Edge: template list fails` (`idp-templates-fail`): an error with retry, and the entries are kept.
  - FR-029, with `idp-templates-many`: the template choice offers a search.
  - US1-AS6 and FR-012:
    - the review summarises every value, shows the secret only as "entered", shows the latest test result and lists the return addresses;
    - Save sends one `saveIdentityProvider` without `If-Match`;
    - the overview shows the type, "complete", "directory password sign-in", "No mailbox uses it yet" and the secret as "Set";
    - the success is announced;
    - `getPublicConfig` is requested again.
  - The same flow for Keycloak and for generic OIDC on the desktop project, as one page with a section index.
  - API gap 3: when `PUT` answers `200` in a first setup, the announcement says that an existing configuration was replaced.
  - FR-016: leaving the setup with entries asks for confirmation (`useLeaveGuard`), and "Stay" keeps the entries.
  - `Edge: network loss during a save`: nothing is reported as saved, and the entries stay.
  - `Edge: very long values`: 2,000-character URLs and long DNs wrap at 360 px.
- [X] T018 *(done: `tests/e2e/identity-provider/connection-test.spec.ts`: legacy's alert text plus the category, every category, the busy action and the 90-second "no result" with `page.clock`, the client rules first, offline, the request body, and the stored configuration's test without a secret. Staleness marks and the Keycloak `view-users` note are not built (legacy lacks them))* [P] [US1] Write `tests/e2e/identity-provider/connection-test.spec.ts`. It covers:
  - US1-AS3 and FR-036: with `connectionTest.outcome: credentialsRejected`, the result says that the credentials were rejected, with its hint, the tested address, the type and the time; it is announced; and no save request is sent.
  - Each other category (`unreachable`, `timedOut`, `tlsCertificateRejected`, `unexpectedResponse` with status 404) shows its translated hint, and success shows text plus an icon with a text alternative (FR-075).
  - US1-AS4 and FR-037: a successful test, then a changed host, marks the result "refers to earlier values". A change to the mapping does not.
  - FR-035: while running, the action is disabled and the progress is announced. With `hang` and `page.clock`, after 90 seconds "No result was received" appears with "Test again".
  - FR-034: in the setup, an empty secret is marked at its field and no test request is sent.
  - FR-038: an invalid URL is marked and no request is sent.
  - The Keycloak success note on the unchecked `view-users` permission, when user import is on.
  - `Edge: test while offline` (`route.abort()`): the network message with retry.
  - The request body is the candidate built from the entered values.
- [X] T019 *(done: `tests/e2e/identity-provider/access.spec.ts`; the setup route is gone (the form is on the screen itself))* [P] [US1] Write `tests/e2e/identity-provider/access.spec.ts`. It covers US1-AS8, FR-001, FR-002 and SC-010: with UI 001's active domain-administrator and mailbox-user scenarios:
  - the navigation has no "Identity providers and OAuth2" entry;
  - `/ng/identity-providers/provider` and `/ng/identity-providers/provider/setup` show "no access";
  - `mockApi.requests()` contains no operation of API 012.

  As an administrator, the entry leads to the identity provider screen, and `/ng/identity-providers` redirects there.
- [X] T020 *(done: `form-model.spec.ts` (one form model for the three types; request bodies checked with the mock validator); there are no sections to test (one section, legacy form))* [P] [US1] Write `tests/unit/features/identity-providers/provider/form-model.spec.ts` and `tests/unit/features/identity-providers/provider/sections.spec.ts` (data-model §2, research R11). Check:
  - `formFromDefaults` uses `capabilities.defaults`;
  - `formFromConfig` maps stored `null` to `''` and `useSsl` to `connectionSecurity: 'ssl'`, whatever `useStartTls` says;
  - `toInput` trims strings, removes empty host and URL entries, sends empty `filter`, `attributeField` and `defaultTemplate` as `null`, maps `connectionSecurity` back to the two booleans, omits an empty secret and never sends read-only members;
  - the built bodies pass the mock validator's request validation for `saveIdentityProvider` and `testIdentityProviderConnection` for each type;
  - `toCandidate` covers its three contexts;
  - `sections` lists exactly the members of the FR-006 table per type, and `fieldSection` maps `attributeMapping.2.template` to `signIn`.
- [X] T021 *(done: `validation.spec.ts`, including `isLdapHost`)* [P] [US1] Write `tests/unit/features/identity-providers/provider/validation.spec.ts`. It is table-driven over the rules of data-model §6 with the limits from capabilities (FR-018). Cases include:
  - `scopes` of 51 names, a name with `"` and a double space;
  - a filter `(&(a=b)(c=d)` (unbalanced);
  - the attribute field required while `periodicSync` is on;
  - attribute values `Staff` and `staff` accepted as different;
  - duplicate additional return URLs;
  - a secret of 1,001 characters.

  - `isLdapHost`: `openldap` and `ldap1.example.org`, `192.0.2.10` and `2001:db8::1` are accepted; `ldap_1.example.org`, `192.0.2.10/24`, a 64-character label and 254 characters are refused.

  Messages use `validation.<code>` with the API's parameters.
- [X] T022 *(done: the secret rule in `validation.spec.ts`; no setup steps exist)* [P] [US1] Write `tests/unit/features/identity-providers/provider/secret-rule.spec.ts` and `tests/unit/features/identity-providers/provider/setup-steps.spec.ts`.
  - `secretRequirement`:
    - in the setup: `noStoredSecret`;
    - in an edit with an unchanged address: optional;
    - with a changed Keycloak `serverUrl`, generic OIDC `tokenEndpoint` or LDAP `hosts` (including reordering): `addressChanged`;
    - with another type: `typeChanged`.
  - Setup steps:
    - five for Keycloak and generic OIDC, four for LDAP;
    - a `?step=` beyond the furthest valid step normalises to it;
    - an unknown value normalises to `type`.
- [X] T023 *(done: `components.spec.ts` (`useConnectionTest` with its limit and busy start, `ConnectionTest` with category, status, progress and problems); no dependency staleness (dropped))* [P] [US1] Write `tests/unit/features/identity-providers/provider/connection-test.spec.ts` and `tests/unit/features/identity-providers/provider/ConnectionTestPanel.spec.ts` (research R16).
  - `TEST_DEPENDENCIES` per type: changes to a listed member mark the result stale, other changes do not.
  - With fake timers, the 90-second abort calls `AbortController.abort()` and sets `noResult`.
  - A second start while running is ignored.
  - The pre-check stops on client errors and on a missing required secret.
  - Panel: the result as text plus an icon with a text alternative, the category hint, the provider status for `unexpectedResponse`, the Keycloak permission note, the stale label, and polite announcements.
- [X] T024 *(done: `components.spec.ts` covers `ProviderSecretField`, `AppReturnAddresses` and `MappingField`; legacy's one host field and two switches replace `HostListField` and `ConnectionSecurityChoice`; the template picker is a plain select; `SyncIntervalField` (readable interval) is not built (legacy lacks it))* [P] [US1] Write component tests in `tests/unit/features/identity-providers/provider/fields/`:
  - `AttributeMappingField.spec.ts`: add up to `attributeMappingMaxEntries`, remove labelled with the value, focus on the new entry, duplicate marking, cards below `md`;
  - `TemplateSelect.spec.ts`: a native select with up to 15 templates, a Combobox with client-side search above that, a missing stored template labelled "Template missing", the "None" choice for the default template;
  - `HostListField.spec.ts`;
  - `ConnectionSecurityChoice.spec.ts`: the port hints;
  - `UrlListField.spec.ts`;
  - `AppReturnAddressList.spec.ts`: each address through `CopyableValue`, the announcement, selection on refusal, text not links (FR-082), and the mismatch warning;
  - `ProviderSecretField.spec.ts`: on `PasswordInput`; "Set", "Not set" or "Required"; the required reason; `autocomplete="new-password"` and the password-manager opt-outs; no remove action; the value emptied on `reset` and unmount;
  - `SyncIntervalField.spec.ts`: the readable interval "every 15 minutes", "every 2 hours", "every 90 minutes".
- [X] T025 *(done: `IdentityProviderPage.spec.ts` (create, client errors, section edit, cancel and stored test, removal, in-use refusal, load retry) and `SectionNav.spec.ts`; the setup page does not exist)* [P] [US1] Write `tests/unit/features/identity-providers/provider/IdentityProviderSetupPage.spec.ts`, `tests/unit/features/identity-providers/provider/IdentityProviderPage.spec.ts` and `tests/unit/features/identity-providers/SectionNav.spec.ts`.
  - Setup:
    - steps below `lg` and one page with a section index from `lg` up, keeping the entries across a resize;
    - focus and announcements;
    - `useLeaveGuard` while entries exist;
    - `201` and `200` announcements through `useStatusMessage`;
    - `422` errors mapped to their step with summary links that open that step;
    - the secret emptied after a refused save and on unmount.
  - Overview: the empty state for a `null` configuration; the error state with retry for other failures; the read-only sections with the stored values.
  - FR-070: the save announcement stays while it has focus or is hovered.
  - `SectionNav`: renders only links whose route is registered, with `aria-current="page"`.
- [X] T026 *(superseded by the legacy form map, nothing to build: usage counts, synchronisation status and the return-path check are panels legacy never shows (plan "Decisions at implementation"))* [P] [US1] Write the unit tests for the overview models.
  - `tests/unit/features/identity-providers/provider/usage.spec.ts` (data-model §2, FR-005, FR-013, FR-039):
    - `canRemove` only when every count is 0;
    - `blocked(T)` from the other sources' counts;
    - `canChangeType` false while the configured type has mailboxes;
    - with 3 `genericOidc` mailboxes under an LDAP configuration, only `genericOidc` is changeable;
    - the links carry `authSource`.
  - `tests/unit/features/identity-providers/provider/sync-status.spec.ts`: the label and icon per state, the explanations for `overdue` and `unknown`, `formatInterval` per locale, and the task names `Keycloak Sync` and `LDAP Sync`.
  - `tests/unit/features/identity-providers/provider/return-addresses.spec.ts`: `/ng/sso/return` matches, while `/ng/sso/callback` and `/sso/return` are reported.
- [X] T027 *(done in substance by `IdentityProviderPage.spec.ts` and `edit.spec.ts` (every stored value of each type in the read-only section); empty values show "None")* [P] [US1] Write `tests/unit/features/identity-providers/provider/overview-parity.spec.ts` with the fixture set `tests/unit/features/identity-providers/provider/fixtures/parity.ts` (SC-007). For an LDAP, a Keycloak and a generic OIDC configuration with legacy defaults, and with legacy-stored values (an empty `filter`, `null` optional values, hosts with IPv6 addresses, 100 mapping entries), the overview renders every non-secret member of the representation with the same value. Empty required values show "Not set" and empty optional values "None" (FR-007).
- [X] T028 *(done: `tests/smoke/identity-provider.smoke.spec.ts` with `tests/smoke/fixtures/identity-provider.ts`, tagged `@idp`, skipped unless `SMOKE_IDP=1`; one case at 360 × 780)* [P] [US1] Write `tests/smoke/fixtures/identity-provider.ts` and `tests/smoke/identity-provider.smoke.spec.ts`, tagged `@idp` and skipped unless `SMOKE_IDP=1`.
  - The fixture, as `admin` through the API: creates the mailbox template "Staff" if missing, and removes the identity provider configuration before and after the test when no mailbox uses it.
  - The spec, through the app:
    1. Set up LDAP with host `openldap`, base DN `dc=example,dc=org`, bind DN `cn=admin,dc=example,dc=org`, attribute field `title` and mapping `staff` → "Staff".
    2. Test with a wrong bind password ("credentials rejected"), then with `ldap-secret` (success).
    3. Save, and check that the overview shows "complete" and the bind password as "Set".

  One case runs at 360 × 780.

### Implementation for User Story 1

- [X] T029 *(done: `provider/api.ts` with direct calls for every write and the test, `If-None-Match: *` for the first setup (G20), and `api.spec.ts` checking that no cache holds a typed secret; the template list uses UI 003's key from `src/api/query/keys.ts` (no `src/features/mailboxes` yet))* [US1] Implement `src/features/identity-providers/provider/api.ts` (research R10, R12, R14, R16), and add a non-behavioural export of UI 003's "all templates" query (`['mailbox-templates','all']`, `limit=1000&sort=name`) to `src/features/mailboxes/index.ts` if it is not exported yet.
  - Queries:
    - capabilities: `staleTime` 5 min;
    - configuration: `staleTime` 30 s, with `identity-provider-not-configured` mapped to `null`.
  - `saveIdentityProvider(input, etag?)`: calls the generated client directly (PUT with an optional `If-Match`), never `useMutation`, because the body may carry a secret (`docs/conventions.md`, research R14). On success it writes the secret-free response to the configuration query and invalidates the capabilities and `['public-config']`. It returns whether the answer was `201` or `200`.
  - `testIdentityProviderConnection(candidate, signal)`: a direct client call with an `AbortSignal`; the result stays in component state.
  - A unit test in `tests/unit/features/identity-providers/provider/api.spec.ts` asserts that after a save and a test with a typed secret, no value of the query cache or the mutation cache contains it.
- [X] T030 *(done: `form-model.ts` (no `sections.ts`: one section))* [P] [US1] Implement `src/features/identity-providers/provider/sections.ts` and `src/features/identity-providers/provider/form-model.ts`. The form types are derived from the generated input types with mapped types; there are no hand-written API shapes. T020 must pass.
- [X] T031 *(done: `validation.ts` (hosts with `isIpNetwork`) and `secret-rule.ts`)* [P] [US1] Implement `src/features/identity-providers/provider/validation.ts` (limits from `capabilities.limits` and `src/shared/validation/limits.ts`; `isLdapHost` on UI 001's `isIpNetwork`) and `src/features/identity-providers/provider/secret-rule.ts`, so that T021 and T022 (secret rule) pass.
- [X] T032 *(done in part: no setup steps, usage, synchronisation status or return-path check (legacy form map); `useConnectionTest.ts` holds the test model)* [P] [US1] Implement `src/features/identity-providers/provider/setup-steps.ts`, `connection-test.ts`, `usage.ts`, `sync-status.ts` and `return-addresses.ts` in `src/features/identity-providers/provider/`, so that T022 (steps), T023 (model part) and T026 pass.
- [X] T033 *(done: `ProviderSecretField`, `TextField`, `SwitchField`, `ReturnUrlFields`, `AppReturnAddresses` and `IdentityProviderForm` in legacy order, help texts visible and tied with `aria-describedby`)* [P] [US1] Implement the field components in `src/features/identity-providers/provider/components/fields/`:
  - `ProviderSecretField.vue`: on UI 005's `PasswordInput`, the status "Set", "Not set" or "Required", the required reason from `secret-rule.ts`, no remove action, `autocomplete="new-password"`, `data-1p-ignore`, `data-lpignore="true"`, `data-bwignore` and `data-form-type="other"`, and the value emptied on reset and unmount (research R14);
  - `KeycloakConnectionFields.vue`, `OidcConnectionFields.vue`, `LdapConnectionFields.vue` and `LdapDirectorySearchFields.vue`, with the secret through `ProviderSecretField`;
  - `HostListField.vue`;
  - `ConnectionSecurityChoice.vue`, a radio group with the hints `admin.iam_use_ssl_info` and `admin.iam_use_tls_info`;
  - `UrlListField.vue`;
  - `AppReturnAddressList.vue`, on UI 010's `CopyableValue`, with the mismatch warning of `return-addresses.ts`;
  - `CreationFields.vue`;
  - `SynchronisationFields.vue`, with the explanations of FR-020 and FR-021;
  - `SyncIntervalField.vue`.

  Help texts are visible and tied to their controls with `aria-describedby` (FR-074). T024 must pass, except for the two components of T034.
- [X] T034 *(done: `MappingField.vue` with plain selects (owner instruction: as in legacy))* [P] [US1] Implement `src/features/identity-providers/provider/components/fields/AttributeMappingField.vue` and `TemplateSelect.vue` (Reka `Combobox` without `ComboboxViewport` above 15 templates), so that their parts of T024 pass.
- [X] T035 *(done: `useConnectionTest.ts` and `ConnectionTest.vue`)* [P] [US1] Implement `src/features/identity-providers/provider/composables/useConnectionTest.ts`, `src/features/identity-providers/provider/components/ConnectionTestPanel.vue` and `ConnectionTestResult.vue`. The 90-second limit uses `setTimeout` and an `AbortController`; results are kept in component state only. T023 must pass.
- [X] T036 *(done as `useProviderEditor.ts` and the page's form: the first setup is legacy's form on the screen, not a step flow; `useLeaveGuard` while entries exist)* [US1] Implement the setup flow, so that the setup part of T025 passes.
  - `src/features/identity-providers/provider/composables/useSetupFlow.ts`: the form state, the furthest valid step, the step address parameter (Next and Back push, normalisation replaces), validation per step, the test state, save with the `201` or `200` announcement through `useStatusMessage`, and the `422` mapping to steps.
  - `src/features/identity-providers/provider/components/setup/ProviderTypeStep.vue`, `SetupProgress.vue` ("Step n of m" plus an `<ol>` with `aria-current="step"`), `SetupSectionIndex.vue` and `SetupReview.vue`.
  - `src/features/identity-providers/provider/pages/IdentityProviderSetupPage.vue`: steps below `lg`, one page from `lg` up, and `useLeaveGuard`.
- [X] T037 *(done: `IdentityProviderValues.vue` in one `EditableSection` titled with the type; no overview header, counts, TLS warning or sync status (legacy form map))* [US1] Implement the read-only overview, so that the overview part of T025 and T027 pass.
  - `src/features/identity-providers/provider/components/EmptyState.vue`.
  - `OverviewHeader.vue`:
    - the type;
    - completeness, as text plus an icon, with the missing-settings warning;
    - the abilities, from `capabilities.types`, the configuration's `complete` and `mailpasswordFlow`;
    - `UsageSummary.vue`;
    - the last change.
  - `UsageSummary.vue`: the configured type's count first, then other sources with mailboxes, each with a link to the route `mailboxes` with `?source=<type>`.
  - `TlsWarning.vue` and `SyncStatus.vue`. The job-log link `{ name: 'operations-log', params: { logType: 'cron' }, query: { task } }` is rendered only when that route exists and `canAccess('logs')` holds.
  - `src/features/identity-providers/provider/components/sections/ConnectionSection.vue`, `DirectorySearchSection.vue`, `ReturnAddressesSection.vue`, `SignInSection.vue` and `SynchronisationSection.vue`:
    - read-only on `EditableSection`, without the Edit action yet;
    - "Not set" for each member in `missingSettings` and "None" for empty optional values (FR-007);
    - "Template missing" with its explanation for entries with `templateExists: false` and for `defaultTemplateExists: false`;
    - long values wrapping.
  - `src/features/identity-providers/provider/pages/IdentityProviderPage.vue`: `ListState`-style loading and error states, the empty state for `null`, and the overview otherwise.
- [X] T038 *(done: `SectionNav.vue` with legacy's tab names, `routes.ts` (`identity-providers` redirects to `identity-provider`), the catalogue entry `available`; UI 011's `group` does not exist yet)* [US1] Implement:
  - `src/features/identity-providers/components/SectionNav.vue`;
  - `src/features/identity-providers/routes.ts`, with `identity-providers` redirecting to `identity-provider`, plus `identity-provider` and `identity-provider-setup`, all with `meta.navEntry: 'identityProviders'`;
  - `src/features/identity-providers/index.ts`.

  Register the routes in `src/app/router/routes.ts`, and set the catalogue's `identityProviders` entry to `available` with `group: 'system'` in `src/app/navigation/catalogue.ts` (research R3). T019, UI 001's table-driven visibility test and the `SectionNav` part of T025 must pass.
- [X] T039 *(done: legacy keys by the form map; 9 new `identityProvider.*` strings (type options, failure categories, test progress and limit, provider status, stored, stored-secret help, app return addresses, refused copy, secret changed elsewhere))* [US1] Use the legacy keys of T005a's form map verbatim for every field label, help and info text, option, action and message of the identity provider screens (`admin.iam_*`, `admin.iam_description`, `admin.iam_extra_permission`, `admin.iam_auth_flow_info` with their markup through `SanitizedHtml.vue`, `success.object_modified`, `success.item_deleted`, `success.iam_test_connection`, `danger.iam_test_connection`). Add to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` only the form map's new strings (FR-077 to FR-079: provider names and technical values never translated, "the classic interface" wording, never machine-translated):
  - `identityProviders.*`: the sub-navigation;
  - `identityProvider.*`:
    - the empty state's "Set up" action;
    - the type explanations of FR-010, once approved (plan, "Deviations needing a decision" item 4);
    - the help texts of FR-019 to FR-032 that have no legacy key;
    - the return-address explanation and mismatch warning;
    - the test categories and hints of FR-036;
    - the synchronisation states and explanations of FR-020;
    - the usage texts;
    - the setup step names and "Step {n} of {m}";
    - the announcements.

  No `legacy-map.json` entry and no hand-written Slovak value for a legacy key (the rows marked "sk" in data-model §8 fall back to `en-gb`). Append the rule codes `secretRequired`, `duplicate`, `conflictsWith` and `immutable` and the problem types `identity-provider-not-configured` and `identity-provider-in-use` to `src/i18n/coverage.json` where not listed yet. `npm run i18n:check` must pass.

**Checkpoint**: US1 works on its own: all T016–T028 tests pass (the smoke test with `SMOKE_IDP=1` once API 012 runs). This is the MVP.

---

## Phase 4: User Story 2 - Sign in with single sign-on (Priority: P1)

**Goal**: The single sign-on action on the role-neutral and mailbox-user sign-in screens, in the
clarified order and honouring "force single sign-on"; the return page at `/ng/sso/return` that
captures and strips the parameters before any request and handles every outcome; the end of a
provider session; and the sign-out note.

**Independent Test**: With the mock reporting single sign-on as available and the fake provider
routed, start single sign-on from each sign-in screen. Simulate the return with a valid code and
state, with each error the API can report, with a provider-reported error, with a code alone and
without parameters. Confirm the landing page, the messages, a clean address bar and a request log
without the code or state outside the completion.

### Tests for User Story 2 (write first; must fail)

- [ ] T040 [US2] Implement the single sign-on handlers and scenarios (research R24).
  - `tests/mocks/handlers/single-sign-on.ts`:
    - `startSingleSignOn`:
      - it stores a random state's hash, an `expiresAt` 10 minutes later and the return address `http://<Host>/ng/sso/return` on the scenario session;
      - it answers `authorizationUrl` `https://idp.example.test/auth?client_id=mailcow&redirect_uri=…&response_type=code&scope=…&state=…&code_challenge=…&code_challenge_method=S256`;
      - it answers `409 single-sign-on-not-available` when unavailable or with `startNotAvailable`.
    - `cancelSingleSignOn`: `204`.
    - `completeSingleSignOn`: it consumes the pending entry first. Then it answers `401 sign-in-state-invalid` for a missing, expired or different state, or per `singleSignOn.completion`: `201 SessionCreated` with `state: active` and `authMethod: singleSignOn` and `Location`, `401 sign-in-failed`, `409`, or `503` with `Retry-After: 30`.
    - `reportSingleSignOnProviderError`: it consumes the state and answers `204`, or `401 sign-in-state-invalid`.
  - `tests/mocks/handlers/public-config.ts` and `tests/mocks/scenarios/public-config.ts`: `externalIdentityProvider.singleSignOnAvailable` variants.
  - `tests/mocks/handlers/identity.ts`:
    - `authentication: { method: 'singleSignOn', identityProvider: 'keycloak' }` for single sign-on sessions;
    - with `singleSignOn.endIdpSession`, every authenticated request answers `401 identity-provider-session-ended`, and the session ends.
  - Register everything in `tests/mocks/handlers/index.ts`.
  - Scenarios in `tests/mocks/scenarios/single-sign-on.ts`:
    - `sso-available` (Keycloak, mailbox `anna@example.org`) and `sso-available-oidc`;
    - `sso-force` (with `forceSingleSignOn`), `sso-force-ldap` (force set, LDAP configured, not available) and `sso-force-none`;
    - `sso-auto-create`, `sso-refused`, `sso-provider-down`, `sso-disabled-after-start` and `sso-not-available-on-start`;
    - `sso-signed-in` and `sso-session-ends`.
- [ ] T041 [P] [US2] Write `tests/e2e/fixtures/provider.ts` and expose it through `tests/e2e/fixtures/test.ts` (research R24). `fakeProvider(page, options)` routes `https://idp.example.test/**`.
  - Mode `redirect` answers `302` to the request's `redirect_uri` with:
    - `code=mock-code-<n>&state=<echoed>`; or
    - `error=<code>&state=<echoed>`, optionally with an `error_description`; or
    - only `code`.
  - Mode `page` serves a minimal HTML page with "Approve" and "Cancel" links that redirect the same way.
- [ ] T042 [P] [US2] Rewrite UI 001's tests to the new behaviour (research R7, FR-041, FR-042). They must fail until T055.
  - In `tests/e2e/sign-in/sign-in-screen.spec.ts`:
    - US1-AS15 now expects, with force single sign-on but no available single sign-on, the normal screen with the password form;
    - US1-AS16 now expects that no identity provider hint is shown;
    - the force-SSO edge case without passkey support now expects the password form when single sign-on is unavailable.
  - In `tests/unit/features/auth/SignInPage.spec.ts`, replace the FR-007 and FR-008 cases with the R7 matrix.
- [ ] T043 [P] [US2] Write `tests/e2e/single-sign-on/sign-in-screen.spec.ts`. It covers:
  - US2-AS1 and FR-040: the role-neutral and mailbox-user screens offer "Sign in with single sign-on" as a full-width action; the administrator and domain-administrator screens do not.
  - US2-AS11: with `stubCredentials` the order is passkey, single sign-on, "or", password form; on `withoutPasskeySupport` single sign-on comes first.
  - US2-AS10 and FR-041:
    - with `sso-force` and passkey support: passkey, single sign-on and the permitted "Not the correct login?" links, with no form and no "Forgot password?";
    - without passkey support: only single sign-on and the links;
    - with `sso-force-ldap` and `sso-force-none`: the screen without the option;
    - the administrator screen keeps its form.
  - FR-042: with an LDAP provider configured, no "cannot use your password here" hint on any screen.
  - FR-044: starting never opens a second page (`context.pages().length` stays 1).
- [ ] T044 [P] [US2] Write `tests/e2e/single-sign-on/round-trip.spec.ts` with `fakeProvider`. It covers:
  - US2-AS2 and FR-043: tapping shows a busy state, a second tap sends nothing, and the provider address opens in the same tab.
  - US2-AS3, FR-045 to FR-047 and SC-011:
    - signed out, `/ng/mailboxes?page=2` leads to sign-in with `returnTo`;
    - single sign-on, then the return shows "Completing sign-in", announced;
    - `page.url()` has no `code` or `state` at the first check after load;
    - the landing is `/ng/mailboxes?page=2` with no second-factor step;
    - `mockApi.requests()` shows the code and state only in the completion body, and in no `Referer` header and no other request;
    - from the return page's load to the landing takes under 3 seconds (SC-002 sanity bound).
  - SC-011 with storage blocked (an init script that makes `sessionStorage` throw): the landing is `home`.
  - US2-AS4: a return whose state does not match (`page.goto` with a random state) shows "sign-in expired or already completed"; Try again starts a new sign-in and sends no second completion.
  - US2-AS5 and FR-048:
    - `error=access_denied` with an `error_description` sends `reportSingleSignOnProviderError` with `{ error, state }` only and shows the cancelled message without the provider's text;
    - an error code with a quote character, or an error without a state, sends `cancelSingleSignOn` instead.
  - FR-048, a code without a state: `cancelSingleSignOn`, then the state-invalid message.
  - US2-AS6 (`sso-refused`): one generic message, no reason.
  - US2-AS7 (`sso-provider-down`): "not reachable", with Try again.
  - `sso-disabled-after-start`: "not offered", only "Back to sign-in", and the action gone from the sign-in screen.
  - `Edge: single sign-on becomes unavailable before tapping` (`sso-not-available-on-start`): a message, the public configuration refetched, and the action hidden.
  - FR-049 and `Edge: reload of the return screen`: after a reload no parameters remain; an active session shows the app, otherwise the sign-in screen without an error.
  - `Edge: Browser Back from the provider` (mode `page`, then `page.goBack()`): every sign-in action is usable again.
  - "Back to sign-in" keeps `returnTo`.
  - `Edge: another account signs in in a second tab during the round trip`: after completion the current session's state is shown.
  - FR-047: `sso-auto-create` lands like an existing mailbox.
  - FR-068: no outcome shows the API's English `title` or `detail`.
  - FR-080: every request made during the round trip matches a contract operation (the mock validator), and none goes to `idp.example.test`; the provider is reached only by navigation.
- [ ] T045 [P] [US2] Write `tests/e2e/single-sign-on/session-end.spec.ts`. It covers:
  - US2-AS8 and FR-052:
    - on `sso-session-ends`, after `mockApi.patch({ singleSignOn: { endIdpSession: true } })`, the next navigation shows the sign-in screen with the "single sign-on session ended" explanation and the single sign-on action;
    - no request goes to the provider;
    - after signing in again through the fake provider, the same page opens.
  - US2-AS9 and FR-053: on `sso-signed-in`, sign-out shows the confirmation with the provider note. A password session's sign-out does not.
- [ ] T046 [P] [US2] Write `tests/unit/features/auth/sso/capture.spec.ts`, `return-to.spec.ts` and `return-classify.spec.ts` in `tests/unit/features/auth/sso/` (research R4–R6, data-model §2).
  - Capture, with a fake `location` and `history`:
    - only on `/ng/sso/return`;
    - the first `code`, `state` and `error` are read, every other parameter is dropped;
    - `replaceState` is called with the path only and keeps `history.state`;
    - `takeCapturedSingleSignOnReturn()` returns the values once.
  - Kept address: written only for values that `validateReturnTo()` accepts; removed otherwise; read and removed once; a throwing storage yields `null`.
  - Classification: the table of data-model §2, including the length limits 4,096 and 512 and the error pattern.
- [ ] T047 [P] [US2] Write `tests/unit/features/auth/useSingleSignOnStart.spec.ts`, `useSingleSignOnReturn.spec.ts`, `SingleSignOnButton.spec.ts` and `SingleSignOnReturnPage.spec.ts` in `tests/unit/features/auth/`.
  - Start:
    - busy state and no double start;
    - the WebAuthn ceremony is aborted;
    - an `authorizationUrl` that `safeHref()` rejects is never navigated to;
    - `location.assign` with the API's address;
    - the kept address is written just before;
    - `409` invalidates `['public-config']`;
    - `pageshow` with `persisted` resets the busy state.
  - Return: the outcome table of research R6, with "Try again" calling the start with the address held in memory and never re-sending the old code.
  - Page: the branding, the announced progress, focus on the outcome heading, and the actions per outcome.
- [ ] T048 [P] [US2] Extend `tests/unit/app/session/session-end.spec.ts` and `tests/unit/app/router/guards.spec.ts`.
  - Session end: `401 identity-provider-session-ended` from any query, mutation or CSRF replay ends the session with notice `ssoSessionEnded` and `returnTo` set to the current path. `sign-out` sets `signedOutSso` when the cached identity's `authentication.method` is `singleSignOn`, and `signedOut` otherwise.
  - Guards: a route with `meta.anySession` resolves in the `anonymous`, `pendingSecondFactor`, `restricted` and `active` states without a redirect.
- [ ] T049 [P] [US2] Extend the `image` job in `.github/workflows/ci.yml` (research R27). `GET /ng/sso/return?code=x&state=y` on the running container must answer `200` with `index.html` and the CSP header. It fails until T058.
- [ ] T050 [P] [US2] Write `tests/smoke/single-sign-on.smoke.spec.ts`, tagged `@sso`. It is skipped, with a message naming the variables, unless `SMOKE_SSO_USERNAME` and `SMOKE_SSO_PASSWORD` are set.
  1. Open `/ng/sign-in/mailbox-user` and choose single sign-on.
  2. Sign in on the real Keycloak page (`#username`, `#password`, `#kc-login`).
  3. Check that the landing is home.
  4. Check that the address and `sessionStorage` hold no `code` or `state`.
  5. Sign out; the provider note is shown.

### Implementation for User Story 2

- [ ] T051 [US2] Implement `src/features/auth/sso/capture.ts`, export `captureSingleSignOnReturn` from `src/features/auth/index.ts`, and call it as the first statement of `src/main.ts`, before the router and `bootstrap()` (research R5). The capture part of T046 must pass.
- [ ] T052 [P] [US2] Implement `src/features/auth/sso/return-to.ts` (through `src/shared/platform/storage.ts` and `validateReturnTo()`) and `src/features/auth/sso/return-classify.ts`, so that the rest of T046 passes.
- [ ] T053 [US2] Add `startSingleSignOn` and `cancelSingleSignOn` mutations, and `completeSingleSignOn` and `reportSingleSignOnProviderError` as direct client calls (their bodies carry the provider's code and state, which never enter a TanStack Query cache, `docs/conventions.md`), to `src/features/auth/api.ts`. On `201` the completion applies the same cache writes, identity fetch and `session-changed` broadcast as UI 001's sign-in mutations (data-model §3).
- [ ] T054 [US2] Implement `src/features/auth/composables/useSingleSignOnStart.ts`, `src/features/auth/components/SingleSignOnButton.vue` (full width, busy state) and `src/features/auth/components/OrDivider.vue` (`role="separator"` with an accessible label), so that the start and button parts of T047 pass.
- [ ] T055 [US2] Compose `src/features/auth/pages/SignInPage.vue` per research R7. Delete `src/features/auth/components/SsoNotice.vue` and `src/features/auth/components/IdpHint.vue` and their imports. Remove `mailcowui-ng.sso-return-to` when the page mounts. T042 and T043 must pass.
- [ ] T056 [US2] Implement:
  - `src/features/auth/composables/useSingleSignOnReturn.ts`;
  - `src/features/auth/pages/SingleSignOnReturnPage.vue`, in `AuthLayout` with `SignInHeader`, an `<h1>` "Completing sign-in", the progress and the outcome messages of FR-048;
  - the `sso-return` route (`/sso/return`, `meta.anySession: true`) in `src/features/auth/routes.ts`;
  - the `anySession` rule in `src/app/router/guards.ts`.

  T044, and the return and guard parts of T047 and T048, must pass.
- [ ] T057 [US2] Implement the session reactions (research R9):
  - the notices `ssoSessionEnded` and `signedOutSso` in `src/app/session/store.ts`;
  - a session-end reason in `src/app/session/session-end.ts`;
  - `identity-provider-session-ended` in the `onError` reactions of `src/api/query/client.ts` and in the replay path of `src/api/csrf.ts`;
  - the method check before `DELETE /session` in `src/app/session/sign-out.ts`;
  - the two notice texts in `src/features/auth/components/SignInNotice.vue`.

  T045 and the session part of T048 must pass.
- [ ] T058 [P] [US2] Add a `location = /ng/sso/return` block with `access_log off` to `docker/nginx/default.conf`. It serves `/ng/index.html` and includes `security-headers.conf`. T049 must pass.
- [ ] T059 [US2] Label the single sign-on action with the legacy `admin.iam_sso`, and show `danger.login_failed` for a failed return without a more specific outcome. Add these new strings to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`:
  - `auth.sso.*`: the busy announcement, the return page title and progress, each outcome of FR-048 with "Try again" and "Back to sign-in", and "not offered";
  - `session.notice.ssoSessionEnded` and `session.notice.signedOutSso`.

  Use "the classic interface" wording where it applies. Append the problem types `single-sign-on-not-available`, `sign-in-state-invalid`, `identity-provider-unavailable` and `identity-provider-session-ended` to `src/i18n/coverage.json`. `npm run i18n:check` must pass.

**Checkpoint**: US1 and US2 both work on their own.

---

## Phase 5: User Story 3 - Sign in with an LDAP or Keycloak password (Priority: P1)

**Goal**: LDAP and Keycloak mailboxes sign in through UI 001's password form, with a distinct
temporary-failure message when the provider is unreachable.

**Independent Test**: With the mock, sign in through the role-neutral and the mailbox-user screens
with responses for success, second factor required, restricted session, generic failure, "identity
provider unavailable" and throttling.

### Tests for User Story 3 (write first; must fail)

- [ ] T060 [US3] Extend `createSession` in `tests/mocks/handlers/auth.ts` for provider accounts. It answers:
  - `201` with `authMethod` `directoryPassword`, `directoryPasswordAndSecondFactor`, `providerPassword` or `providerPasswordAndSecondFactor`;
  - `pendingSecondFactor` for a directory account with TOTP;
  - `restricted` with `secondFactorSetup` for a Keycloak account whose template forces second-factor setup;
  - `503 identity-provider-unavailable` with `Retry-After` when `providerOutage` is set, which counts towards no throttling.

  Add `tests/mocks/scenarios/provider-password.ts` with `ldap-password` (`carl@example.org`), `ldap-password-totp`, `ldap-provider-down`, `keycloak-password-forced-2fa` and `ldap-throttled`.
- [ ] T061 [P] [US3] Write `tests/e2e/sign-in/provider-password.spec.ts`. It covers:
  - US3-AS1 and FR-050: `ldap-password` reaches home through the role-neutral and the mailbox-user screen; `ldap-password-totp` reaches the second-factor step.
  - US3-AS2 and FR-051, on `ldap-provider-down`:
    - "your organisation's sign-in service is not reachable";
    - the username kept and the password cleared;
    - no "wrong password" wording and no countdown;
    - an immediate retry is possible.
  - US3-AS3 and FR-042: no identity provider hint with a provider configured.
  - US3-AS4: `keycloak-password-forced-2fa` shows UI 001's pending-actions screen.
  - Throttling (`ldap-throttled`) and the generic failure behave as in UI 001.
  - `Edge: provider unreachable during a password sign-in` adds no waiting time.
- [ ] T062 [P] [US3] Extend `tests/unit/features/auth/usePasswordSignIn.spec.ts`: `identity-provider-unavailable` sets the temporary-failure message, keeps the username, clears the password, moves focus to the message and starts no throttle countdown despite `retryAfter`.
- [ ] T063 [P] [US3] Write `tests/smoke/provider-password.smoke.spec.ts`, tagged `@idp`, skipped unless `SMOKE_IDP=1`. In `beforeAll` the fixture of T028 configures LDAP through the API. Then `carl@example.org` signs in with `Passw0rd!dev` through the app, reaches home and signs out.

### Implementation for User Story 3

- [ ] T064 [US3] Add the `identity-provider-unavailable` branch to `src/features/auth/composables/usePasswordSignIn.ts`, and its message rendering to `src/features/auth/components/PasswordForm.vue` (research R8), so that T061 and T062 pass.
- [ ] T065 [US3] Add `auth.signIn.providerUnavailable` to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. `npm run i18n:check` must pass.

**Checkpoint**: All P1 stories (US1 to US3) work.

---

## Phase 6: User Story 4 - Maintain the identity provider (Priority: P2)

**Goal**: Section editing with version tags and conflict marking, the secret address rule, the test
in the connection edit and on the overview, the type change with blocked types, the removal, and the
in-use refusals.

**Independent Test**: With a stored configuration of each type, edit each section, change an
address with and without the secret, save with an outdated version tag, change the type with and
without mailboxes in use, and remove the configuration.

**Depends on**: US1 (overview, setup flow, form model).

### Tests for User Story 4 (write first; must fail)

- [X] T066 *(done: change, removal, `rotateEtagOnNextWrite` and `removedElsewhere`; scenarios `idp-ldap-in-use`, `idp-other-source`, `idp-keycloak`, `idp-oidc`, `idp-incomplete`, `idp-template-missing`, `idp-changed-elsewhere`, `idp-removed-elsewhere` (the sync-state and return-path scenarios are not needed))* [US4] Extend `tests/mocks/handlers/identity-provider.ts`:
  - `updateIdentityProvider`: merge patch with whole arrays, `If-Match` and `412`; `immutable` for another `type`; `conflictsWith` for foreign members and for an empty `attributeField` with `importUsers` or `periodicSync`; `secretRequired` with `reason: addressChanged` and `field`; the normalisations;
  - `deleteIdentityProvider`: `204`; `409` with the counts while any count is above 0; `412`;
  - the switches `rotateEtagOnNextWrite` and `removedElsewhere` (answering `404 identity-provider-not-configured`).

  Add these scenarios to `tests/mocks/scenarios/identity-provider.ts`:
  - `idp-ldap-in-use` (340 LDAP mailboxes) and `idp-other-source` (LDAP configured, 3 `genericOidc` mailboxes);
  - `idp-keycloak` (mailpassword flow on) and `idp-oidc`;
  - `idp-incomplete` (Keycloak stored without `clientSecret` and `realm`, `missingSettings` set);
  - `idp-template-missing` and `idp-ignore-tls`;
  - `idp-sync-overdue`, `idp-sync-running`, `idp-sync-unknown` and `idp-sync-disabled`;
  - `idp-return-path-mismatch`;
  - `idp-changed-elsewhere` and `idp-removed-elsewhere`.
- [X] T067 *(done in `edit.spec.ts` (values in legacy order, Edit, Test Connection, Remove, History) and `connection-test.spec.ts` (the stored test); counts, abilities, sync status, TLS and return-path warnings are not built (legacy form map))* [P] [US4] Write `tests/e2e/identity-provider/overview.spec.ts`. It covers:
  - US4-AS1 and FR-005: the type, completeness, abilities, the count with its link to `/ng/mailboxes?source=ldap`, the last change, one read-only section per group with its Edit action, and the actions Test connection, Change provider type and Remove. The History action is tested in US6 (T090).
  - FR-078: in Czech the last change and sync times are formatted for `cs-CZ`, while "Keycloak", "LDAP", URLs and DNs stay as they are.
  - `Edge: other source` (`idp-other-source`): the 3 generic OIDC mailboxes are shown with a link.
  - US4-AS5 and FR-007: "Template missing" with its explanation.
  - `Edge: incomplete configuration` (`idp-incomplete`): the warning, "Not set" at `realm` and at the secret, and Test connection unavailable with the reason.
  - US4-AS8 and FR-008: the TLS warning on the overview and in the connection section.
  - FR-020: each synchronisation state as text plus an icon; the overdue and unknown explanations; the last completed run, the failure time and the next run; "every 15 minutes"; and the Cron log link to UI 011 filtered by `LDAP Sync`.
  - FR-027 (`idp-return-path-mismatch`): the return-path warning.
  - FR-033 on the overview: the test runs on the stored values without a secret, and its body has no secret member.
- [X] T068 *(done: `tests/e2e/identity-provider/edit.spec.ts` (full-screen on phones, `?edit=provider` and reload, merge patch with If-Match and normalised values, the address rule, secret emptied, outdated save and Save again, leave guard, attribute field rule, removed elsewhere))* [P] [US4] Write `tests/e2e/identity-provider/section-edit.spec.ts`. It covers:
  - FR-015: at 360 px the edit opens full-screen with a sticky Save and Cancel bar, on desktop in place; the address carries `edit=<section>`, and a reload reopens the section with the stored values and an empty secret.
  - US4-AS3: saving the synchronisation section sends `updateIdentityProvider` with `Content-Type: application/merge-patch+json`, `If-Match` and only that section's changed members; the section shows the normalised stored values (StartTLS off with SSL, a trailing slash removed); the outcome is announced.
  - US4-AS2, FR-025 and FR-034:
    - changing the LDAP hosts, the Keycloak server URL or the OIDC token endpoint makes the secret required with "it would be sent to a new address" before anything is sent;
    - with the secret entered, test then save;
    - an unchanged address with an empty secret keeps it, and no secret member is sent (FR-024).
  - FR-026: the secret field is empty after a save, after a refused save and after Cancel.
  - US4-AS4, FR-017 and SC-009 (`idp-changed-elsewhere`): the save is stopped, the entries are kept, the changed settings are marked with their new values, and "Save again" sends the new tag; no automatic re-send.
  - FR-070: the "Section saved" announcement is made and stays while focused.
  - One section in edit at a time.
  - FR-016: leaving an edit with changes asks for confirmation.
  - FR-069: a `422` `conflictsWith` on `attributeField` while turning on synchronisation shows a summary item that links to the directory search section.
  - `idp-removed-elsewhere`: the edit closes into the empty state with an explanation.
  - `Edge: network loss during a save`: the input is kept.
- [X] T069 *(done in `edit.spec.ts`: type change as a whole save with If-Match and its secret, the in-use refusals with `danger.authsource_in_use`, removal with legacy's confirmation and refreshed public configuration, the outdated removal asked again. No type-change confirmation or blocked-type reasons (legacy lacks them))* [P] [US4] Write `tests/e2e/identity-provider/type-change-removal.spec.ts`. It covers:
  - US4-AS6, FR-013 and FR-039 (`idp-ldap-in-use`): Change provider type and Remove are unavailable with "340 mailboxes" and the link.
  - `idp-other-source`: Remove is unavailable, and in the type step only generic OIDC is selectable while Keycloak shows its reason.
  - FR-013 (`idp-keycloak` with no mailboxes):
    - the confirmation names Keycloak and says its settings and secret will be removed on save;
    - the setup opens at the type step with Keycloak disabled as the current type;
    - leaving changes nothing;
    - saving LDAP sends `saveIdentityProvider` with `If-Match`.
  - FR-014: an injected `409` on that save shows the counts and the links, with nothing changed.
  - US4-AS7: removal of `idp-ldap` names the consequences; then the empty state and the announcement follow; `getPublicConfig` is requested again; and a new page context's sign-in screen offers no single sign-on.
  - A `412` on removal refetches and asks for confirmation again (conventions).
- [X] T070 *(done: `toPatch` in `form-model.spec.ts`; the changed-elsewhere list in `useProviderEditor.spec.ts`)* [P] [US4] Write `tests/unit/features/identity-providers/provider/patch.spec.ts` and `conflict.spec.ts` in `tests/unit/features/identity-providers/provider/`.
  - `toPatch`:
    - only changed members of the section;
    - arrays as whole lists;
    - the secret only when typed;
    - `null` when nothing changed;
    - every result passes the mock validator for `updateIdentityProvider`.
  - `changedSettings(before, after, section)`: lists changed members with their new values, reports a `clientSecretSet` or `bindPasswordSet` change as "changed elsewhere" without a value, and reports "changed, possibly a secret" when only the tag differs.
- [X] T071 *(done: `IdentityProviderPage.spec.ts` and `useProviderEditor.spec.ts`; no `InUseMessage` or overview header (legacy shows `danger.authsource_in_use` only))* [P] [US4] Write component tests:
  - `tests/unit/features/identity-providers/provider/sections/*.spec.ts`: edit mode on `EditableSection`, Save disabled while saving, secret emptying, conflict marks;
  - `tests/unit/features/identity-providers/provider/InUseMessage.spec.ts`: counts and links from `identityProviderInUseDetails`;
  - `tests/unit/features/identity-providers/provider/OverviewHeader.spec.ts`: the availability of each action from `usage.ts` and `complete`, with reasons.

### Implementation for User Story 4

- [X] T072 *(done: `toPatch` in `form-model.ts`, the changed-elsewhere list in `useProviderEditor.ts`, `updateIdentityProvider` and `deleteIdentityProvider` as direct calls)* [US4] Implement `src/features/identity-providers/provider/patch.ts` and `conflict.ts`. Add `updateIdentityProvider(patch, etag)` (a direct client call, never `useMutation`: PATCH with `application/merge-patch+json`, `If-Match`) and `useDeleteIdentityProvider` (`If-Match`) to `src/features/identity-providers/provider/api.ts`, with the cache effects of data-model §3. Extend `tests/unit/features/identity-providers/provider/api.spec.ts`: no cache holds a secret typed into a section save. T070 must pass.
- [X] T073 *(done as `useProviderEditor.ts` with the page's `?edit=provider` handling)* [US4] Implement `src/features/identity-providers/provider/composables/useSectionEdit.ts`:
  - one section in edit at a time, through `EditableSection` and the `edit` query parameter (UI 002 D11);
  - `toPatch`;
  - `useVersionedSave` with `changedSince` and `changedSettings`;
  - `422` mapping with cross-section summary links via `fieldSection`;
  - `404` into the empty state;
  - the secret emptied after every outcome.

  Add the edit forms to `src/features/identity-providers/provider/components/sections/*Section.vue`, reusing the field components of T033 and T034, with the test panel in the connection section's edit. T068 and the section part of T071 must pass.
- [X] T074 *(done: Test Connection on the stored values, Remove with legacy's confirmation through `useVersionedSave.remove`; the type change is the form's select, as legacy, with no confirmation and no blocked types)* [US4] Implement the overview actions in `src/features/identity-providers/provider/components/OverviewHeader.vue` and `src/features/identity-providers/provider/pages/IdentityProviderPage.vue`:
  - Test connection on the stored values, unavailable while incomplete;
  - Change provider type, through `useConfirm`, then `identity-provider-setup?mode=change`;
  - Remove, through `useConfirm` and `useDeleteIdentityProvider`;
  - `src/features/identity-providers/provider/components/InUseMessage.vue`.

  Extend `src/features/identity-providers/provider/composables/useSetupFlow.ts` and `src/features/identity-providers/provider/components/setup/ProviderTypeStep.vue` for change mode: the configuration's tag and counts, the current and blocked types disabled with reasons, `If-Match` on save, and the `412` reload. T067, T069 and the rest of T071 must pass.
- [X] T075 *(done: no further strings: saves use `success.object_modified`, removal `success.item_deleted`, refusals `danger.authsource_in_use`, outdated handling UI 002's `sections.*`; "removed elsewhere" is `problem.identity-provider-not-configured`)* [US4] Add the `identityProvider.*` new strings of T005a's form map for these to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` (saves use `success.object_modified`, removal `success.item_deleted`):
  - section edits, saves and conflicts, including "changed elsewhere, possibly a secret";
  - the secret required reasons as field help;
  - the type change and removal confirmations with their consequences;
  - the unavailable reasons;
  - the in-use details with `blockingMailboxes`, next to the legacy `danger.authsource_in_use`, which is used verbatim;
  - "removed elsewhere".

  `npm run i18n:check` must pass.

**Checkpoint**: US1 to US4 work on their own.

---

## Phase 7: User Story 5 - Manage OAuth2 clients (Priority: P2)

**Goal**: The OAuth2 apps screen: a list with search, sort, a token filter, paging and bulk revoke
and delete; the information panel; creation with the credentials dialog; the client page with
redirect URIs, a new secret, token revocation, deletion and the outdated and not-found handling.

**Independent Test**: With the mock, list, search, filter, sort and page through clients on both
viewports. Create, edit, regenerate, revoke and delete, including bulk actions with a failing item,
and confirm that a secret appears only in the credentials dialog.

**Depends on**: US1 for `src/features/identity-providers/routes.ts` and `SectionNav.vue` (T038).

### Tests for User Story 5 (write first; must fail)

- [ ] T076 [US5] Implement `tests/mocks/handlers/oauth2-clients.ts` for all nine OAuth2 operations, registered in `tests/mocks/handlers/index.ts`.
  - `listOauth2Clients`: `q` over the client ID and redirect URIs, case-insensitive; `hasActiveTokens`; `sort` `id`, `clientId` or `redirectUri`; `order`; paging; `ListMeta`.
  - `createOauth2Client`: `201` with `Location`, `ETag`, a 12-hex client ID, a 24-hex `clientSecret` and scope `profile`. `422` errors: `invalidFormat` (`redirectUri`) at `redirectUris.<i>`, `tooLong` on `redirectUris` above 2,000 joined characters, `required`.
  - `getOauth2Client`, and `updateOauth2Client` (merge patch, `immutable` for `clientId` and `scope`, `If-Match`).
  - `deleteOauth2Client`, `regenerateOauth2ClientSecret` and `revokeOauth2ClientTokens`, each with `If-Match`, `412` and `404`.
  - `bulkOauth2ClientAction`: up to 100 targets (`tooMany` beyond); per-item `done`, `notFound`, `outdated` (version mismatch) or `failed`; `summary`.

  Add `tests/mocks/scenarios/oauth2-clients.ts` with:
  - `oauth2-empty`;
  - `oauth2-many`: 40 clients, two with "wiki" in their redirect URIs, one with 12 active access tokens, one with 2,000-character URIs;
  - `oauth2-legacy-invalid`: one client with an empty list and one with a fragment URI;
  - `oauth2-changed-elsewhere` and `oauth2-deleted-elsewhere`;
  - `oauth2-bulk-partial`: three clients, one whose version is rotated;
  - `oauth2-bulk-twenty`: 20 clients, one failing.
- [ ] T077 [P] [US5] Write `tests/e2e/oauth2-clients/list.spec.ts`. It covers:
  - US5-AS1 and FR-055:
    - at 360 px each client is a card with its client ID, identifier, first redirect URI, "+N more" and both token counts, or "No active tokens";
    - on desktop a table with the same values;
    - no secret text anywhere in the DOM.
  - US5-AS7 and FR-054: searching "wiki" lists only the matching clients; the filter "with active tokens", the sorts, page and page size of 25, 50 or 100 are kept across a reload.
  - US5-AS8 and FR-056: the empty state offers "Add OAuth2 client"; a search without matches offers to clear it.
  - FR-003: the loading state, and the error state with a retry after a `500` on `listOauth2Clients`.
  - FR-057:
    - the information panel is collapsed at 360 px and open on desktop;
    - it shows the endpoint addresses on the current host with copy actions, the `profile` scope, the grant types the capabilities report and the token lifetimes as durations.
  - SC-010: domain administrators and mailbox users get "no access" at `/ng/identity-providers/oauth2-apps` without API 012 requests.
  - The sub-navigation now shows both links.
  - `Edge: very long values` wrap at 360 px.
- [ ] T078 [P] [US5] Write `tests/e2e/oauth2-clients/create.spec.ts`. It covers:
  - US5-AS3 and FR-058:
    - a relative URI, one with `#frag` and one with a space are each marked at their entry, and no request is sent;
    - duplicates are marked;
    - the remaining-length counter falls as entries grow.
  - US5-AS2 and FR-059:
    - entering `https://wiki.example.org/oauth/callback` and submitting opens a dialog with the client ID and the secret, both with copy actions, and the warning;
    - closing without copying the secret asks for confirmation, and so do Escape and Back;
    - after closing, the client page opens and the secret appears nowhere.
  - `Edge: clipboard refused`: the secret is selected with an explanation.
  - `Edge: credentials dialog lost`: after a reload the secret is gone, and the page offers "Generate new secret".
  - SC-008: the flow completes at 360 px.
- [ ] T079 [P] [US5] Write `tests/e2e/oauth2-clients/detail.spec.ts`. It covers:
  - FR-060: the identifier, the client ID with copy, the scope, the counts, the redirect URIs, the note that the secret is hidden, and a client ID and scope that cannot be edited.
  - Saving a second redirect URI sends `updateOauth2Client` with `If-Match` and `redirectUris` only.
  - FR-061 (`oauth2-legacy-invalid`): the stored fragment URI is marked with its rule, and Save stays blocked until it is corrected; an empty stored list reads "No redirect URI stored".
  - US5-AS4 and FR-062: the confirmation names the client ID and the consequences; the new secret is shown once in the dialog.
  - US5-AS5 and FR-063: the confirmation names the client and "12 access tokens"; afterwards the counts are 0 and the outcome is announced.
  - `Edge: revoking a client without tokens` succeeds.
  - US5-AS6 and FR-064: the confirmation names the client ID and first redirect URI and says it cannot be undone; then the list opens without the client, announced.
  - FR-066 and SC-009 (`oauth2-changed-elsewhere`): a redirect URI save is stopped, keeps the input and marks the change; a regeneration, revocation or deletion refetches and asks again with the fresh values.
  - `Edge: deleted by another administrator` (`oauth2-deleted-elsewhere`): the not-found state with a link to the list.
  - An unknown ID shows "not found".
- [ ] T080 [P] [US5] Write `tests/e2e/oauth2-clients/bulk.spec.ts`. It covers:
  - US5-AS9 and FR-065 (`oauth2-bulk-partial`):
    - an explicit selection mode;
    - three selected, Delete;
    - the confirmation lists the three client IDs with their counts and needs "3" typed;
    - the request body has `action: delete` and `targets` with each `id` and its listed `etag` as `version`;
    - the summary shows two deleted and one outdated, which stays selected.
  - Revoke tokens in bulk.
  - No "generate new secret" bulk action.
  - The selection clears on a page, search, filter, sort or page size change.
  - "Retry" sends exactly the failed, refused and outdated clients with the refreshed list's version tags.
  - With `bulkLimit` overridden to 2 in the capabilities, a third client cannot be selected, and a message states the limit.
  - SC-013 (`oauth2-bulk-twenty`): 20 outcomes, and only the failed one stays selected.
  - A dropped connection (`route.abort()` on the bulk request) shows "outcome unknown", and no second request is sent.
- [ ] T081 [P] [US5] Write unit tests in `tests/unit/features/identity-providers/oauth2/`:
  - `list-state.spec.ts`: data-model §5 mapping, `tokens` → `hasActiveTokens`, defaults omitted, resets;
  - `redirect-uris.spec.ts`: the rules of data-model §2, custom schemes such as `com.example.app:/callback` accepted, `remaining` and `duplicateOf`;
  - `bulk.spec.ts`: `toBulkTargets()` with `String(id)` and the `etag` without its quotes as `version`.
- [ ] T082 [P] [US5] Write component tests in `tests/unit/features/identity-providers/oauth2/`:
  - `RedirectUriListField.spec.ts`;
  - `ClientCredentialsDialog.spec.ts`: the client ID and secret copy, the confirmation keyed on the uncopied secret, nothing written to storage, the router or the cache;
  - `Oauth2InfoPanel.spec.ts`;
  - `Oauth2ClientCard.spec.ts`: token status as text, not colour only;
  - `Oauth2BulkActions.spec.ts`.
- [ ] T083 [P] [US5] Write `tests/smoke/oauth2-clients.smoke.spec.ts`. As `admin`:
  1. Create a client with `https://wiki.example.org/oauth/callback`, copy the secret and close the dialog.
  2. Add a second redirect URI.
  3. Generate a new secret.
  4. Revoke the tokens.
  5. Create a second client, revoke both in bulk, then delete both.

### Implementation for User Story 5

- [ ] T084 [US5] Implement `src/features/identity-providers/oauth2/api.ts`, `list-state.ts`, `redirect-uris.ts` and `bulk.ts` in `src/features/identity-providers/oauth2/`.
  - `api.ts`: the capabilities, list and detail queries; create and regenerate as direct client calls (`docs/conventions.md`, research R22): `clientSecret` goes into the credentials dialog's state, and only the representation without it is written to the cache, which a unit test in `tests/unit/features/identity-providers/oauth2/api.spec.ts` asserts for both caches; update with `If-Match` and merge patch; revoke, delete and bulk, with the invalidation of data-model §3.
  - `bulk.ts`: `toBulkTargets()` with `{ id: String(client.id), version }`, where `version` is the list entry's `etag` without its surrounding quotes.

  T081 must pass.
- [ ] T085 [P] [US5] Implement the list components in `src/features/identity-providers/oauth2/components/`:
  - `Oauth2ClientList.vue`;
  - `Oauth2ClientCard.vue` (below `md`);
  - `Oauth2ClientTable.vue` (from `md` up, with `aria-sort` headers);
  - `Oauth2ClientFilters.vue` (search, token filter, a native sort select for cards);
  - `TokenCounts.vue`;
  - `Oauth2InfoPanel.vue` (Reka `Collapsible`, copyable endpoint addresses from the capabilities);
  - `Oauth2BulkActions.vue` (on `useBulkSelection` with `capabilities.bulkLimit`, so that further selection is disabled at the limit with a message that states it; `BulkActionBar`; `ConfirmDialog` with `requireTyped` for deletion; `BulkResultSummary`).
- [ ] T086 [P] [US5] Implement `src/features/identity-providers/oauth2/components/RedirectUriListField.vue` and `ClientCredentialsDialog.vue` (wrapping `OneTimeSecretDialog` with the client ID as a second `CopyableValue`), so that T082 passes.
- [ ] T087 [US5] Implement the pages in `src/features/identity-providers/oauth2/pages/`:
  - `Oauth2ClientsPage.vue`: `useListState`, `ListState`, `PaginationBar`, the panel and bulk;
  - `Oauth2ClientCreatePage.vue`: the form, then the dialog, then `router.replace` to the detail page, with the route-leave confirmation while the dialog is open;
  - `Oauth2ClientDetailPage.vue`: the attributes, the redirect URIs on `EditableSection`, the actions through `useConfirm` with refetch and re-confirmation on `412`, the deletion announcement through `useStatusMessage` after returning to the list, and the not-found state.

  Add the routes `oauth2-clients`, `oauth2-client-create` and `oauth2-client-detail` (`:oauth2ClientId(\d{1,10})`) to `src/features/identity-providers/routes.ts`. T077–T080 must pass.
- [ ] T088 [US5] Use the legacy keys of T005a's form map verbatim for the OAuth2 screens: the list (`admin.oauth2_apps`, the `draw_oauth2_clients` column titles, `mailbox.toggle_all`, `mailbox.quick_actions`, `mailbox.remove`, `admin.oauth2_revoke_tokens`, `admin.oauth2_add_client`), the information panel (`admin.oauth2_info` through `SanitizedHtml.vue`), the create form (`admin.oauth2_redirect_uri`, `admin.add`), the client page (`edit.client_id`, `edit.client_secret`, `edit.scope`, `edit.redirect_uri`, `admin.save`) and the messages (`success.object_modified`, `success.items_deleted`). Add to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` only the form map's `oauth2.*` new strings:
  - the empty state and the token filter;
  - the grant type labels, once approved (plan, "Deviations needing a decision" item 5);
  - the create success, duplicate, empty-URI and scope messages, which legacy hard-codes in English;
  - the create page, the dialog warning and the client page;
  - the confirmations of FR-062 to FR-064;
  - the bulk texts.

  No `legacy-map.json` entry. `npm run i18n:check` must pass.

**Checkpoint**: US1 to US5 work on their own.

---

## Phase 8: User Story 6 - Trace identity provider and OAuth2 changes (Priority: P3)

**Goal**: The audit log labels and detail renderers for API 012's records, and the History actions
on the overview and the client page.

**Independent Test**: With audit records of every API 012 event type, target type, sign-in method
and failure reason, open the history from the overview and from a client page, apply the target,
event type and outcome filters, and confirm the entries.

**Depends on**: US1 (overview) and US5 (client page) for the History links. The labels and renderers
are independent.

### Tests for User Story 6 (write first; must fail)

- [ ] T089 [US6] Create `tests/mocks/factories/audit-identity-provider.ts` and `tests/mocks/scenarios/audit-identity-provider.ts`, registered in `tests/mocks/scenarios/index.ts`. The scenario `audit-identity-provider` holds:
  - an `identityProviderUpdate` changing `syncInterval` from 15 to 60, with `bindPassword: { changed: true }`;
  - an `identityProviderConnectionTest` with `testedAddress`, `outcome: failure` and `failureCategory: credentialsRejected`;
  - a refused `identityProviderDeletion` with `mailboxCounts`;
  - each `oauth2Client*` event, with `removed` counts and a `bulkRequestId`;
  - a failed `signIn` with `authMethod: singleSignOn`, attempted username `anna@example.org` and `failureReason: noMatchingMapping`;
  - a `signIn` with `providerReturnedError` and `details.providerError: access_denied`;
  - a successful `directoryPassword` sign-in;
  - a `mailboxCreation` with `trigger: identityProviderSignIn`, `template: Staff` and `signInRequestId`;
  - an `identityProviderSessionEnd`;
  - one record for every remaining API 012 `AuditFailureReason`.
- [ ] T090 [P] [US6] Write `tests/e2e/audit-log/identity-provider-history.spec.ts`. It covers:
  - US6-AS1: History on the overview opens the audit log with `targetType=identityProvider` and its chip.
  - History on a client page opens it with `targetType=oauth2Client` and `targetId=<id>`.
  - FR-067: the audit log's target type filter offers "Identity provider configuration" and "OAuth2 client".
  - US6-AS2: the update entry shows "Sync interval: 15 → 60" and "Bind password: changed", with no value.
  - US6-AS3: the test entry names the type, the tested address and the translated outcome.
  - US6-AS4, with the event type sign-in and outcome failure: the single sign-on entry shows its method label, the e-mail address and "no matching mapping"; no sign-in method filter is offered (API gap 1).
  - FR-067:
    - revocations and deletions show the removed counts;
    - the refused deletion shows its counts;
    - the mailbox creation shows the template, a link to the mailbox and a "Sign-ins of this account" link to `/ng/audit-log?actor=anna@example.org&event=signIn`;
    - the provider error shows the code `access_denied` as a technical value;
    - every failure reason of API 012 has a translated label.
  - The entries wrap at 360 px.
- [ ] T091 [P] [US6] Extend `tests/unit/features/audit-log/labels.spec.ts` and `tests/unit/features/audit-log/AuditEventDetails.spec.ts`.
  - Every API 012 `AuditEventType`, `AuditTarget.type`, `AuthMethod` and `AuditFailureReason` value has a label.
  - The renderers of research R23 show `changes`, secrets as changed, test details, `removed`, `mailboxCounts`, the sign-in details and the provisioning links.
  - Unknown `details` keys fall back to UI 001's definition list.
  - Unknown enumeration values, given as plain values (not mocked responses, 001 R22), show the generic label.

### Implementation for User Story 6

- [ ] T092 [US6] Extend `src/features/audit-log/labels.ts`. Implement `src/features/audit-log/components/details/IdentityProviderDetails.vue`, `Oauth2ClientDetails.vue` and `ProviderSignInDetails.vue`, and dispatch to them by event type in `src/features/audit-log/components/AuditEventDetails.vue`. Render the keys that mailcow-rest-v2's `docs/audit-events.md` documents for API 012's event types; if they differ from research R23, follow that file and adjust T089 and T091. Unknown keys are shown verbatim, and values are text only. T091 must pass.
- [ ] T093 [US6] Add `HistoryLink` to `src/features/identity-providers/provider/components/OverviewHeader.vue` (`targetType: 'identityProvider'`, no `targetId`) and to `src/features/identity-providers/oauth2/pages/Oauth2ClientDetailPage.vue` (`targetType: 'oauth2Client'`, `targetId: String(id)`). T090 must pass.
- [ ] T094 [US6] Add the `auditLog.*` messages for the API 012 event types, target types, auth methods, failure reasons and detail labels to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Append those values to the `AuditEventType`, `AuditTarget.type`, `AuthMethod` and `AuditFailureReason` lists of `src/i18n/coverage.json` (UI 002 D2). `npm run i18n:check` must pass.

**Checkpoint**: All user stories work on their own.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story verification, budgets, translations, parity notes and validation on real
devices and a real API.

- [ ] T095 [P] Write and pass `tests/e2e/identity-provider/reflow-and-keyboard.spec.ts`. These states have no horizontal scroll at 320 px and at the equivalent of 400 % zoom (320 CSS px on a 1,280 px desktop), work in landscape on the mobile projects, and never hide the focused element behind the sticky header:
  - every screen and dialog of this feature: overview, setup steps, setup page, section edits, OAuth2 list, create, detail, credentials dialog and bulk summary;
  - the return page states;
  - the sign-in screens with single sign-on.

  Transitions honour `prefers-reduced-motion`. The main paths of US1 (LDAP setup), US2 (single sign-on round trip) and US5 (create and revoke) complete with the keyboard alone, with focus visible at every step (FR-071 to FR-074, SC-004, SC-005).
- [ ] T096 [P] Extend `tests/e2e/shell/storage-and-secrets.spec.ts` (SC-003, FR-081). After the US1, US2, US4 and US5 flows:
  - `localStorage` and `sessionStorage` hold only the keys of UI 001 data-model §4 plus `mailcowui-ng.sso-return-to`, which is absent after a return;
  - no storage value, address, `history.state` or recorded request header contains the code, the state, the bind password, the client secret or an OAuth2 client secret;
  - only the completion request body contains the code and state, and only the setup, edit and test bodies contain the typed secrets.
- [ ] T097 Run `npm run build && npm run budget:check && npm run lhci`. The initial JavaScript must stay at most 204,800 bytes gzipped, with growth of under 1 KB from `capture.ts`. Performance and accessibility must stay at least 0.9 on `/ng/sign-in` and `/ng/`. Fix regressions, for example by splitting the setup page's step components or the template combobox into lazy imports.
- [ ] T098 [P] Run `npm run i18n:check` (SC-006: every API 012 problem type, rule code, test category and audit failure reason is shown with a legacy message or a new string in all three locales; every legacy key used exists in the `en-gb` snapshot) and remove the unused keys it reports from `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Check that no new string duplicates a legacy key of the form map. List the new cs-cz and sk-sk strings of this feature for the owner's native review (plan, owner question 1).
- [ ] T099 [P] Add the plan's two parity notes to the "Legacy Parity" tables in `specs/012-identity-providers-oauth2/spec.md`: the information panel shows `admin.oauth2_info` verbatim (with the accepted grant types only if plan "Deviations needing a decision" item 5 is approved); the secret fields block saved sign-ins from being filled in.
- [ ] T100 Run quickstart.md Part D on a mailcow host with a mid-range Android phone and an iPhone. Record these in a "Validation log" section appended to `specs/012-identity-providers-oauth2/quickstart.md`:
  - the timings of SC-001, SC-002 (20 attempts) and SC-008;
  - the configuration comparison of SC-007;
  - the moderated test of SC-012 (at least 5 administrators);
  - a VoiceOver and TalkBack pass of US1, US2 and US5.
- [ ] T101 Run quickstart.md Part C against the mailcow-rest-v2 dev stack at the pinned commit (`SMOKE_IDP=1 scripts/smoke/stack-up.sh`, `npm run test:smoke`, `scripts/smoke/stack-down.sh`), with the single sign-on smoke test against a Keycloak set up as API quickstart Part B describes. Record the result in the validation log, and propose the Keycloak realm import to mailcow-rest-v2 (plan, owner question 2).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Before this feature**: UI 001 to UI 011 are implemented (their building blocks are checked by
  T002), and mailcow-rest-v2 feature 012 is implemented, so that T001 can pin it and the smoke
  tasks (T028, T050, T063, T083, T101) can run against it.
- **Setup (Phase 1)**: T001 first, because T002 and every later task need the generated types of
  API 012. T003 → T004. T005 is independent.
- **Foundational (Phase 2)** depends on Setup and **blocks every user story**:
  - T005a (the legacy form map) first; every screen and message task depends on it;
  - T006–T009 (tests) in parallel;
  - T010 → T011;
  - then T012–T015. T013 needs T009; T015 needs T008.
- **User stories (Phases 3–8)** depend on Foundational and on each other as the table below shows.
  End-to-end tests start from scenarios whose session is already `active` (or `anonymous` for the
  sign-in stories), so each story is testable on its own.
- **Polish (Phase 9)** depends on every story it verifies.

### User Story Dependencies

| Story | Priority | Depends on | Why |
|---|---|---|---|
| US1 | P1 | Foundational | MVP. Creates the feature folder, routes, form model, setup flow and read-only overview. |
| US2 | P1 | Foundational | Extends UI 001's `auth` feature only. Independent of US1: its scenarios set the public configuration directly. |
| US3 | P1 | Foundational | One branch in UI 001's password sign-in; independent. The smoke test T063 reuses the fixture of T028. |
| US4 | P2 | US1 | Adds editing, type change and removal to US1's overview, setup flow and `provider/api.ts`. |
| US5 | P2 | US1 (T038) | Registers its routes in `src/features/identity-providers/routes.ts` and appears in `SectionNav`. |
| US6 | P3 | US1, US5 (links only) | The History links go onto US1's overview and US5's client page. Labels and renderers are independent. |

### Files edited by several stories

Edits to these files must be serialised, even when the stories run in parallel:

- `src/features/identity-providers/routes.ts`: US1 (T038), US5 (T087).
- `src/features/identity-providers/provider/api.ts`: US1 (T029), US4 (T072).
- `src/features/identity-providers/provider/components/OverviewHeader.vue` and
  `src/features/identity-providers/provider/pages/IdentityProviderPage.vue`: US1 (T037), US4 (T074),
  US6 (T093).
- `src/features/identity-providers/provider/composables/useSetupFlow.ts` and
  `src/features/identity-providers/provider/components/setup/ProviderTypeStep.vue`: US1 (T036),
  US4 (T074).
- `src/features/identity-providers/provider/components/sections/*Section.vue`: US1 (T037), US4 (T073).
- `src/features/identity-providers/oauth2/pages/Oauth2ClientDetailPage.vue`: US5 (T087), US6 (T093).
- `tests/mocks/handlers/identity-provider.ts` and `tests/mocks/scenarios/identity-provider.ts`: US1
  (T016), US4 (T066).
- `tests/mocks/handlers/index.ts`: US1 (T016), US2 (T040), US5 (T076).
- `tests/mocks/handlers/auth.ts`: US3 (T060). `tests/mocks/handlers/identity.ts` and
  `public-config.ts`: US2 (T040).
- `src/features/auth/pages/SignInPage.vue`: US2 (T055) only. `usePasswordSignIn.ts` and
  `PasswordForm.vue`: US3 (T064) only.
- `src/i18n/messages/*.json` and `src/i18n/coverage.json`: T015, T039,
  T059, T065, T075, T088, T094 and T098. Run these one after another.
- `src/features/mailboxes/index.ts` (UI 003's feature): T029 adds one non-behavioural export only.

### Within Each User Story

- First, the mock handlers and scenarios. Then the end-to-end, unit and smoke tests, which must
  fail. Then the implementation (models → api → composables → components → pages → routes), with
  the legacy keys of T005a's form map. Then the story's new strings in all three locales.

### Parallel Opportunities

- Setup: T003 and T005 in parallel after T001 and T002.
- Foundational: T006–T009 together; T012 and T014 together.
- Stories: after Foundational, US1, US2 and US3 can be staffed in parallel; US4 and US5 follow US1;
  US6 follows US1 and US5 for its links.
- Within each story, every task marked [P].

---

## Parallel Example: User Story 1

```bash
# After T016 (handlers and scenarios), write all US1 tests together:
Task: "T017 tests/e2e/identity-provider/setup.spec.ts"
Task: "T018 tests/e2e/identity-provider/connection-test.spec.ts"
Task: "T019 tests/e2e/identity-provider/access.spec.ts"
Task: "T020 form-model.spec.ts + sections.spec.ts"
Task: "T021 validation.spec.ts"   Task: "T022 secret-rule.spec.ts + setup-steps.spec.ts"
Task: "T023 connection-test.spec.ts + ConnectionTestPanel.spec.ts"
Task: "T024 fields/*.spec.ts"     Task: "T025 page and SectionNav specs"
Task: "T026 usage, sync-status, return-addresses specs"   Task: "T027 overview-parity.spec.ts"
Task: "T028 tests/smoke/identity-provider.smoke.spec.ts"

# Then the independent implementation parts:
Task: "T030 sections.ts + form-model.ts"   Task: "T031 validation.ts + secret-rule.ts"
Task: "T032 setup-steps, connection-test, usage, sync-status, return-addresses"
Task: "T033 field components"              Task: "T034 AttributeMappingField + TemplateSelect"
Task: "T035 useConnectionTest + panel"
# T036 (setup), T037 (overview) and T038 (routes) follow, one after another.
```

## Parallel Example: User Story 2

```bash
# After T040 (handlers and scenarios):
Task: "T041 tests/e2e/fixtures/provider.ts"
Task: "T042 rewrite UI 001 sign-in tests"
Task: "T043 single-sign-on/sign-in-screen.spec.ts"   Task: "T044 single-sign-on/round-trip.spec.ts"
Task: "T045 single-sign-on/session-end.spec.ts"      Task: "T046 sso/*.spec.ts"
Task: "T047 start/return/button/page specs"          Task: "T048 session-end + guards specs"
Task: "T049 CI image check"                          Task: "T050 single-sign-on.smoke.spec.ts"
# Then: T051 → T052 [P] with T058 [P] → T053 → T054 → T055 → T056 → T057 → T059
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (pin and prerequisites), then Phase 2 (mock state, keys, constants, messages).
2. Phase 3 (US1): set up, test and save a provider, and the read-only overview.
3. **Stop and validate**: `npm run test:e2e -- tests/e2e/identity-provider` on both viewports, and the
   US1 rows of quickstart Part B. Administrators can now leave the classic Identity Provider tab for
   first setups.

### Incremental Delivery

1. Foundation, then US1 (MVP).
2. US2 (single sign-on) and US3 (provider passwords): mailbox users of every provider type can use
   the app.
3. US4 (maintenance): the classic tab is no longer needed.
4. US5 (OAuth2 apps): the classic OAuth2 tab and edit page are replaced.
5. US6 (audit): investigations stay in the app.
6. Polish: reflow and keyboard, the storage and secret scan, budgets, translations review, parity
   notes, device validation and the smoke run.

### Parallel Team Strategy

After Foundational:
- Developer A: US1, then US4.
- Developer B: US2, then US3.
- Developer C: US5 (after T038), then US6.

Edits to the shared files listed under "Files edited by several stories" run one at a time.

---

## Notes

- [P] tasks touch different files and have no dependency on an incomplete task.
- [USn] labels map tasks to the spec's user stories, and test titles carry the spec IDs for
  traceability.
- Verify that each test fails before implementing (constitution VI).
- Commit after each task or logical group, directly to `main`, with short imperative subjects.
- Never add a hand-written API type, a `v-html` outside `SanitizedHtml.vue`, an inline style or
  script, a storage key other than `mailcowui-ng.sso-return-to` beyond UI 001's list, a request to
  the provider, a client-side filter over paged API results, or an automatic request while idle.
