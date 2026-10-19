# Implementation Plan: Identity Providers and OAuth2

**Branch**: `main` (no feature branches, constitution 1.1.0) | **Date**: 2026-10-18 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-identity-providers-oauth2/spec.md`

## Summary

UI feature 012 replaces the classic System › Configuration › Identity Provider and OAuth2 Apps
tabs, the OAuth2 client edit page and the classic Single Sign-On button. It delivers:

- **the identity provider screen**:
  - an empty state and a setup flow: steps on phones, one page with a section index on wide
    screens;
  - an overview with read-only sections, each edited and saved on its own with the version tag;
  - write-only secrets with the address rule, and a connection test of the entered values;
  - mailbox counts per external source, which predict when removal and a type change are refused;
  - the synchronisation status, and the app's return addresses with a return-path check;
- **single sign-on for mailbox users**:
  - an action on the role-neutral and mailbox-user sign-in screens, which honours
    "force single sign-on" with passkeys first;
  - a return page at `/ng/sso/return` that strips the code and state from the address before any
    request, completes or reports the round trip, and lands on the requested page;
  - the end of a provider session, and the sign-out note;
- **password sign-in of LDAP and Keycloak mailboxes** through UI 001's form, with a distinct
  "provider unreachable" message;
- **the OAuth2 apps screen**: a list with search, sort, a token filter and bulk revoke and delete;
  creation with a secret shown once; a client page with redirect URIs, a new secret, token
  revocation and deletion;
- **audit log additions**: labels, detail renderers and History links.

The technical approach (details in [research.md](./research.md)):

- It reuses UI 001's stack, client, mock API, test fixtures and session machinery unchanged, and
  the shared patterns that UI 002, 003, 005, 010 and 011 build (R1).
- Two code areas: `src/features/identity-providers/` (`provider/`, `oauth2/`) for the admin
  screens, and single sign-on inside `src/features/auth/` (R2).
- The return parameters are captured and stripped by the first statement of `src/main.ts`, before
  the router and the bootstrap (R5).
- The setup, the section edits and the connection test share one form model. It is derived from
  the generated input types, and its request bodies are validated against the contract in unit
  tests (R11).
- Defaults, limits, return addresses, OAuth2 endpoints, token lifetimes and the bulk limit come
  from the two capabilities reads (R10, R21).
- End-to-end tests use a fake provider host routed by Playwright, so the round trip runs on all
  three browser projects without a real provider. Smoke tests use the API's OpenLDAP, and Keycloak
  when it is configured (R24, R25).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) and Vue 3.5 SFCs; Node.js 24 LTS. Unchanged from
UI 001.

**Primary Dependencies**: UI 001's ten runtime dependencies (001 R1). **No new runtime or
development dependency.**

**Storage**: none on a server. In the browser it uses the query cache, Pinia (session store notices
`ssoSessionEnded` and `signedOutSso`) and one new device storage key: `sessionStorage`
`mailcowui-ng.sso-return-to` with a validated in-app path, kept only during a single sign-on round
trip (data-model §4).

**Testing**:

- Vitest and Vue Test Utils for every pure module and component, written first. Request bodies
  are validated against the contract with the mock validator.
- Playwright on `mobile-chromium` (360 px), `desktop-chromium` and `mobile-webkit`, against the
  production build with the production CSP and the contract-validated mock. Every test runs axe in
  both themes, the reflow checks and the touch-target checks. A fake provider is routed with
  `page.route`, and `page.clock` drives the 90-second test limit.
- Smoke tests against the mailcow-rest-v2 dev stack: OpenLDAP and Keycloak of the `idp` profile with
  `SMOKE_IDP=1` (Keycloak with the API's realm import since T101; on a mailcow host with
  `SMOKE_SSO_USERNAME` and `SMOKE_SSO_PASSWORD`).

**Target Platform**: as UI 001: the two latest major versions of evergreen browsers, served under
`/ng/` by the `ng-mailcow` image.

**Project Type**: web application (static single-page frontend; the backend is mailcow-rest-v2).

**Performance Goals**:

- The initial JavaScript stays at most 200 KB gzipped. The entry gains only the capture module,
  about 0.3 KB.
- Three new lazy chunks: the identity provider pages, the OAuth2 pages and the return page.
- The app's own single sign-on steps take under 3 s at p95 on a mid-range phone (SC-002).
- Lighthouse scores of at least 80 for performance and 90 for accessibility on `/ng/sign-in` and `/ng/`.

**Constraints**:

- Strict CSP, with no new inline code and no `v-html`.
- No request to the provider; the browser only navigates there.
- The code, the state and every secret stay out of storage, addresses, history and logs.
- Only contract operations; limits come from the capabilities reads, never hard-coded.
- Usable at 360 and 320 px and at 400 % zoom, with WCAG 2.2 AA in both themes.
- No automatic requests while idle.
- Constitution IV 1.3.0: every language mailcow ships; legacy texts verbatim by their legacy keys,
  loaded at runtime from the installation; new strings only for elements the classic interface
  lacks, complete in en/cs/sk ("Translations and forms (constitution IV 1.3.0)").

**Scale/Scope**:

- 6 user stories (3 at P1, 2 at P2, 1 at P3), 82 functional requirements, 13 success criteria.
- 7 new routes (one a redirect) and 19 new API operations, plus 8 reused in a new way.
- One configuration per server, and up to a few hundred OAuth2 clients.
- About 45 legacy keys used verbatim (data-model §8, completed by T005a's legacy form map), plus
  the new strings for elements the classic interface lacks. The form map fixes their number, kept
  to the minimum.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | Only the 19 operations of API 012 plus API 001, 002 and 003 operations are used ([contracts/README.md](./contracts/README.md)). T001 bumps the pin to the commit that implements API 012, after a diff check of the API 012 contract files against the planning baseline (R1). Types come from the generated schema through `@/api`; the form model is derived from generated input types with mapped types (R11). Errors follow problem types and rule codes. Three missing capabilities are recorded as API gaps (method filter, request filter, create-only precondition) and not worked around: no client-side filtering of paged results (R23). | PASS |
| II. Mobile-first | Every screen is designed at 360 px first. The setup is a step flow below `lg` (R12). The mapping entries and OAuth2 clients are cards below `md`. Section edits open full-screen below `md` (UI 002 pattern). Long values wrap. Removal, type change, deletion, revocation and new secrets are confirmed with their impact, and a bulk deletion needs the typed count. Every collection has loading, empty and error states. | PASS |
| III. Accessibility (WCAG 2.2 AA) | axe in both themes on every screen and state, including every return-page outcome and every test result. Step changes focus the step heading and announce "Step n of m". Outcomes are announced. Status (completeness, test result, sync state, token status, "Template missing") is shown as text plus an icon with a text alternative. Add and remove actions are named after their entry. Help texts are visible. | PASS |
| IV. i18n and branding | Constitution 1.3.0: every mailcow language is offered. The screens mirror the legacy Identity Provider and OAuth2 forms, and their texts are mailcow's own translations, used verbatim by legacy key (data-model §8 and T005a's legacy form map), loaded at runtime from the installation, with markup through `SanitizedHtml.vue` and `en-gb` as the fallback; nothing is hand-written for a legacy key. New strings, only for elements the classic interface lacks, exist in en-gb, cs-cz and sk-sk. Provider names and technical values are never translated. The return page shows the operator's branding from `GET /public-config`. | PASS |
| V. Security in the browser | The code and state are captured and stripped before the first request, kept in memory and sent once (R5). The single new storage key holds a validated in-app path, never a credential (R4). Secrets are write-only, masked, never filled from saved sign-ins and emptied after every outcome. Every request that carries a secret, a provider code or a provider state in its body or response calls the generated client directly and never passes through a TanStack Query cache (`docs/conventions.md`, R14, R22, R27). OAuth2 client secrets exist only in the dialog's state. `authorizationUrl` is checked with `safeHref()`. All API values are rendered as text. Hidden admin entries are a convenience; the shell's "no access" state prevents requests (FR-002). | PASS |
| VI. Test-first | `tasks.md` puts handlers and failing tests before the implementation in every phase. Every acceptance scenario has an end-to-end test on both viewports against the contract-validated mock. Smoke tests run against the real API (single sign-on opt-in: see Complexity Tracking). | PASS (deviation recorded) |
| VII. Performance budgets | All new routes are lazy. The entry grows by the capture module only. `budget:check` and Lighthouse run as in UI 001. No polling of the synchronisation status (R18). Caches are invalidated after mutations (data-model §3). | PASS |
| VIII. Simplicity | No new dependency. Shared blocks from earlier features are reused, never duplicated (R1). Single-use parts stay in the feature: `ProviderSecretField`, `TemplateSelect`, `AttributeMappingField`, `HostListField`, `RedirectUriListField`, `isLdapHost` and the test panel. One form model serves three uses. | PASS |
| Technology constraints | Native `<select>` for small choices; Reka `Combobox` without `ComboboxViewport` for the template search (001 R18). No new copied TailAdmin primitive. The image gains one nginx location (R5). | PASS |
| Workflow and gates | Commits go to `main`. The CI jobs of UI 001 cover every gate, and the image check gains `/ng/sso/return`. | PASS |
| `docs/conventions.md` | It covers the wording ("the classic interface"), list state in the address, page sizes and cards or tables. Bulk actions use the page-only selection, per-item versions and results, and "outcome unknown". Section editing keeps the input on `412` and never merges. Confirmations show the impact. Secrets are shown once or are write-only. History links use the target filters, and audit labels are added. Problem types and rule codes are translated, through the legacy `danger.*` messages where the meaning matches. Admin-only screens show "no access". UI 011's job-log link appears only when that route exists. Limits come from capabilities. | PASS |

**Post-design re-check (after Phase 1)**: PASS. The data model, contracts README and quickstart
introduce no violation. Decisions that touched gates:

- Capturing the return parameters in `src/main.ts`: V (R5).
- One `sessionStorage` key: V (R4, data-model §4).
- Direct client calls, not `useMutation`, for every secret-bearing request: V and
  `docs/conventions.md` (R14, R22, R27).
- No client-side method filter: I (R23, API gap 1).
- A 90-second client timeout for the connection test only: the spec's requirement; the narrow
  exception to 001 R8 is documented in R16.
- The single sign-on smoke test is opt-in: VI (Complexity Tracking).

## Translations and forms (constitution IV 1.3.0)

The owner rule of 2026-10-18 (`docs/conventions.md`, "Translations and forms") applies to every
screen of this feature. It overrides any earlier text in this plan, the spec, research and tasks.

**Legacy forms mirrored** (paths under `../mailhosting/data/web/`):

- **Identity provider screen** (overview, setup and section edits) →
  `templates/admin/tab-config-identity-provider.twig` (one form per type: Keycloak, Generic-OIDC,
  LDAP, chosen with the `admin.iam` select), included from `templates/admin.twig` (System ›
  Configuration). JS: `js/site/admin.js` (`iam_test_connection`, the mapping and redirect URL rows,
  the `#iam_provider` switch). Messages: `identity_provider()` in `inc/functions.inc.php`
  (`success.object_modified`, `success.item_deleted`, `danger.authsource_in_use`,
  `danger.required_data_missing`) and `success.iam_test_connection` / `danger.iam_test_connection`
  from `admin.js`.
- **Single sign-on action** on the sign-in screens → `templates/user_index.twig` (the button
  labelled `admin.iam_sso`, `force_sso`). Return outcomes: `inc/triggers.user.inc.php` and the
  `identity_provider('login'…)` paths of `inc/functions.inc.php` (`danger.login_failed`,
  `success.logged_in_as`).
- **OAuth2 apps list** → `templates/admin/tab-config-oauth2.twig` (`admin.oauth2_apps`,
  `admin.oauth2_info`, `mailbox.toggle_all`, `mailbox.quick_actions`, `mailbox.remove`,
  `admin.oauth2_revoke_tokens`, `admin.oauth2_renew_secret`, `admin.oauth2_add_client`). JS:
  `js/site/admin.js` `draw_oauth2_clients` (columns ID, `admin.oauth2_client_id`,
  `admin.oauth2_client_secret`, `admin.oauth2_redirect_uri`, `admin.action`; row actions
  `admin.edit` and `admin.remove`).
- **Create OAuth2 client** → `templates/modals/admin.twig` `addOAuth2ClientModal`
  (`admin.oauth2_redirect_uri`, `admin.add`).
- **OAuth2 client page** → `templates/edit/oauth2client.twig` (`edit.client_id`,
  `edit.client_secret`, `edit.scope`, `edit.redirect_uri`, `admin.save`). Messages:
  `inc/functions.oauth2.inc.php` (`success.object_modified`, `success.items_deleted`; its add,
  duplicate, empty-URI and scope messages are hard-coded English, not keys).

**Screens or elements without a legacy counterpart** use new strings (en-gb, cs-cz, sk-sk, never
machine-translated), kept minimal: the empty state's "Set up" action, the setup step names and
"Step n of m", section headings, the usage counts and the in-use details, the synchronisation status,
the app's return addresses and the mismatch warning, the connection test's failure categories and
hints, the single sign-on return page and its specific outcomes, the session notices, the token
counts and filter, the credentials dialog, the confirmations, bulk summaries, outdated-version
handling and the audit log labels.

**Deviation-free rule**: these screens add, drop, rename, reword or reorder nothing relative to the
legacy forms above, except the conventions' improvements (sections with their own save, typed
confirmations, bulk mode, outdated-version handling). Labels, help and info texts (`*_info`,
`admin.iam_description`, `admin.iam_extra_permission`, `admin.iam_auth_flow_info`,
`admin.oauth2_info`), placeholders, option labels, units, order and grouping, column headers, action
labels and success, warning and danger messages come from the legacy keys. Every mailcow language
is supported; legacy values are loaded at runtime from the installation and shown verbatim (markup
through `SanitizedHtml.vue`, product names as the installation's files have them); a missing key
falls back to `en-gb`, never to a hand-written value.

### Decisions at implementation (2026-10-19)

The orchestrator settled the plan's "Deviations needing a decision" through `docs/conventions.md`
("Decisions on the deviations found in plans 002–014"): follow the legacy form and its controls, a
legacy tab becomes one section, no help text, explanation or section heading that legacy lacks, no
panel with data legacy never shows, no confirmation legacy lacks except the typed and bulk ones, and
actions that legacy offers only in the list stay in the list. The improvements that stay are
sections with their own save, typed and bulk confirmations, bulk mode and outdated-version
handling. Applied to this feature:

1. **LDAP hosts**: one text field `admin.iam_host` with `admin.iam_host_info` as visible help, as
   legacy has it. The app splits it on commas into the API's `hosts` and shows a stored list joined
   by `, `.
2. **LDAP connection security**: the two switches `admin.iam_use_ssl` and `admin.iam_use_tls` with
   their `*_info` help texts; turning one on turns the other off, as legacy's `onchange` does.
3. **One section**: the identity provider tab is one section with legacy's field order per type.
   There is no setup flow, no step pages, no section index and no section headings. With no stored
   configuration the page shows the same form, ready to fill in (legacy shows the form with
   Keycloak chosen); a stored configuration is shown read-only in one `EditableSection` whose Edit
   opens the form.
4. **No type explanations and no empty state**: `admin.iam_description` is shown verbatim above the
   form; the type select offers legacy's three options (hard-coded `Keycloak`, `Generic-OIDC`,
   `LDAP`, new strings whose text equals legacy's).
5. **OAuth2 information**: `admin.oauth2_info` verbatim above the list. No grant types, token
   lifetimes or copyable endpoints.
6. **OAuth2 secrets**: never shown again (owner). No secret column, no secret field.
7. **Bulk "Generate new client secret"**: kept, through the bulk action `renewSecret` (G42). The
   new secrets are shown once, one client after another, in `OneTimeSecretDialog`.
8. **Redirect URIs**: one text field (`admin.oauth2_redirect_uri` in the create form,
   `edit.redirect_uri` on the client page), as legacy has it. Several URIs are separated by spaces,
   as legacy stores them; the app splits the field on whitespace into `redirectUris`.

Further consequences of the same rules (recorded here, not built):

- Dropped from the identity provider screen because legacy lacks them: the overview header
  (completeness, abilities, last change), the mailbox counts per source with links, the TLS warning,
  the synchronisation status, "Template missing" marks, the type-change confirmation and the
  blocked-type reasons (the API's refusal shows `danger.authsource_in_use`), the readable sync
  interval, the test result's tested address, time and staleness, and the 90-second client limit's
  "Test again" action (the test button is simply usable again).
- Dropped from the OAuth2 screens: token counts, the token filter, the empty-state explanation, the
  copy of the client ID, and the client page's own Generate new secret, Revoke tokens and Delete
  (legacy offers them only in the list: row action `admin.remove`, quick actions `mailbox.remove`,
  `admin.oauth2_revoke_tokens` and `admin.oauth2_renew_secret`).
- Kept although legacy lacks it, because single sign-on in this app cannot work without it: the
  app's own return addresses (`appReturnUrls` of the capabilities), listed read-only with a copy
  button under legacy's redirect URL field, with one new string as their label.
- The template pickers are plain selects, as in legacy, whatever the number of templates.
- The sign-in screens put the single sign-on button where `user_index.twig` has it: after the
  password form and "Forgot password?", below legacy's `login.other_logins` divider. With "force
  single sign-on" and single sign-on available, the password form, "Forgot password?" and the
  divider are hidden; the passkey action stays, as UI 001 keeps it. "Force single sign-on" without
  available single sign-on is ignored (FR-041).

### Legacy form map (T005a)

Paths are under `../mailhosting/data/web/`. "new" marks a new string (en-gb, cs-cz, sk-sk) with its
reason; everything else is a legacy key used verbatim.

#### Identity provider (`/identity-providers/provider`, route `identity-provider`) → `templates/admin/tab-config-identity-provider.twig`

| Element | Legacy key or source |
|---|---|
| Page title (card header) | `admin.iam` |
| Description | `admin.iam_description` (markup, `SanitizedHtml`) |
| Sub-navigation between the two screens (System › Configuration tabs) | `admin.iam`, `admin.oauth2_apps`; landmark name `nav.identityProviders` (existing) |
| Section title of a stored configuration | the type's option text (below) |
| Type select label | `admin.iam` |
| Type options | `Keycloak`, `Generic-OIDC`, `LDAP` (hard-coded in legacy) → new `identityProvider.type.<type>`, same text |
| Keycloak fields, in order | `admin.iam_server_url`, `admin.iam_realm`, `admin.iam_client_id`, `admin.iam_client_secret`, `admin.iam_redirect_url` (+ additional URLs), `admin.iam_version`, mapping, `admin.iam_extra_permission` (markup), `admin.iam_rest_flow` with `admin.iam_auth_flow_info` (markup), `admin.ignore_ssl_error`, `admin.iam_login_provisioning`, `admin.iam_periodic_full_sync`, `admin.iam_import_users`, `admin.iam_sync_interval` |
| Generic-OIDC fields, in order | `admin.iam_authorize_url`, `admin.iam_token_url`, `admin.iam_userinfo_url`, `admin.iam_client_id`, `admin.iam_client_secret`, `admin.iam_redirect_url` (+ additional URLs), `admin.iam_client_scopes` (placeholder `capabilities.defaults.scopes`, legacy's hard-coded value), mapping, `admin.ignore_ssl_error`, `admin.iam_login_provisioning` |
| LDAP fields, in order | `admin.iam_host` with `admin.iam_host_info`, `admin.iam_port`, `admin.iam_use_ssl` with `admin.iam_use_ssl_info`, `admin.iam_use_tls` with `admin.iam_use_tls_info`, `admin.ignore_ssl_error`, `admin.iam_basedn`, `admin.iam_username_field` (placeholder `mail`, the default), `admin.filter`, `admin.iam_attribute_field`, `admin.iam_binddn`, `admin.iam_bindpass`, mapping, `admin.iam_login_provisioning`, `admin.iam_periodic_full_sync`, `admin.iam_import_users`, `admin.iam_sync_interval` |
| Mapping | label `admin.iam_mapping`; columns `user.attribute`, `mailbox.template`; default row `admin.iam_default_template` with `admin.iam_default_template_description` (legacy tooltip, shown as visible help, FR-074); empty option `-- ` + `mailbox.template` + ` --` as the template renders it |
| Add and remove buttons of the mapping and the additional URLs (icon-only in legacy) | accessible names `admin.add` and `mailbox.remove`, the remove action with the entry's value |
| Secret help when a secret is stored | new `identityProvider.secretStored` (write-only secrets, conventions "Secrets") |
| The app's return addresses | new `identityProvider.appReturnUrls` (label), copy button `secrets.copy`, `secrets.copied`, `secrets.copyRefused` (existing) |
| Read-only values: on and off switches | new `identityProvider.on`, `identityProvider.off`; empty values `—` |
| Read-only mapping entry | attribute value → template, as text |
| Buttons | `admin.iam_test_connection`, `admin.save`, `mailbox.remove`; section Edit, Cancel and the outdated actions from `EditableSection` |
| Show and hide a typed secret (legacy eye button) | `auth.signIn.showPassword`, `auth.signIn.hidePassword` (existing) |

Messages:

| Outcome | Message |
|---|---|
| Save (`PUT` 201 or 200, `PATCH` 200) | `success.object_modified` with `''`, as `identity_provider('edit')` returns it |
| Removal (204) | `success.item_deleted` with `''` |
| `identity-provider-in-use` (409, save of another type or removal) | `danger.authsource_in_use` (through `LEGACY_TEXTS`) |
| Removal confirmation | `footer.confirm_delete`, `footer.delete_these_items`, the type's option text, `footer.delete_now`, `footer.cancel` (legacy `#ConfirmDeleteModal`) |
| Test success / failure | `success.iam_test_connection` / `danger.iam_test_connection` (`admin.js`) |
| Test failure category | new `identityProvider.test.failure.<category>` (5 values; legacy cannot report the category) and `identityProvider.test.providerStatus` for `unexpectedResponse` |
| No test result within 90 s | new `identityProvider.test.noResult` |
| `identity-provider-not-configured` on a section save or removal | new `problem.identity-provider-not-configured`; the page then shows the empty form |
| Outdated (412) | `EditableSection`'s outdated notice (UI 002) with field labels from the legacy keys above |
| Rule codes | `validation.<code>`; API 012 formats `validation.format.<format>`; `secretRequired` with `reason` → new `validation.byParam.secretRequired.reason.<reason>` and `notFound` with `resource: mailboxTemplate` → new `validation.byParam.notFound.resource.mailboxTemplate` (UI 004's parameter lookup, with `reason` added to its discriminating parameters); `duplicate` → new `validation.duplicate`; `conflictsWith` → UI 004's `validation.conflictsWith` |

#### Single sign-on (`/sign-in`, `/sign-in/mailbox-user`) → `templates/user_index.twig`; return page `/ng/sso/return` (no legacy page)

| Element | Legacy key or source |
|---|---|
| Divider before the button | `login.other_logins` |
| Button | `admin.iam_sso` |
| Return page title and progress | new `auth.sso.return.title`, `auth.sso.return.progress` |
| Provider reported an error | new `auth.sso.outcome.cancelled` |
| Completion refused as failed | `danger.login_failed` |
| State invalid, provider unavailable, not available, other errors | `problem.sign-in-state-invalid`, `problem.identity-provider-unavailable`, `problem.single-sign-on-not-available` (new), UI 001's problem messages |
| Actions | `common.retry` (existing), new `auth.sso.backToSignIn` |
| Busy state of the button | new `auth.sso.starting` |
| Session ended at the provider (sign-in notice) | new `auth.notice.ssoSessionEnded` |
| Signed out of a single sign-on session (sign-in notice) | new `auth.notice.signedOutSso` |
| Password sign-in while the provider is unreachable | `problem.identity-provider-unavailable` (new) |

#### OAuth2 apps (`/identity-providers/oauth2-apps`, route `oauth2-clients`) → `templates/admin/tab-config-oauth2.twig`, `js/site/admin.js` `draw_oauth2_clients`

| Element | Legacy key or source |
|---|---|
| Title | `admin.oauth2_apps` |
| Information | `admin.oauth2_info` (markup) |
| Columns | `ID` (hard-coded) → new `oauth2.columns.id`; `admin.oauth2_client_id`; `admin.oauth2_redirect_uri`; `admin.action`. No secret column (owner) |
| Row actions | `admin.edit`, `admin.remove` |
| Search, paging, empty, loading | `datatables.search`, `datatables.emptyTable`, `datatables.zeroRecords`, `datatables.loadingRecords`, UI 001's `PaginationBar` |
| Sort control (cards) | `domains.sort.*` (UI 002's sort labels), options `oauth2.columns.id`, `admin.oauth2_client_id`, `admin.oauth2_redirect_uri` |
| Selection and quick actions | UI 002's `bulk.*`; actions `mailbox.remove`, `admin.oauth2_revoke_tokens`, `admin.oauth2_renew_secret` |
| Add | `admin.oauth2_add_client` |
| Confirmations | `footer.confirm_delete`, `footer.delete_these_items`, `footer.delete_now`, `footer.cancel`; the bulk deletion's typed count `bulk.confirm.typeCount`; revoke and renew use the action's label as title and `footer.delete_these_items` before the client IDs |
| New secrets of a renewal | `OneTimeSecretDialog` titled `admin.oauth2_renew_secret`, described by `admin.oauth2_client_id` and the client ID |

Messages: deletion `success.items_deleted` with the ID; revocation and renewal
`success.object_modified` with the ID (legacy `oauth2('edit')`); bulk lines the same per client
with UI 002's bulk summary.

#### Add OAuth2 client (`/identity-providers/oauth2-apps/new`, route `oauth2-client-create`) → `templates/modals/admin.twig` `addOAuth2ClientModal`

| Element | Legacy key or source |
|---|---|
| Title | `admin.oauth2_add_client` (the modal's title is a hard-coded "OAuth2"; the button that opens it carries this key) |
| Field | `admin.oauth2_redirect_uri` (required) |
| Button | `admin.add` |
| Created (201) | "Added client access" (hard-coded in `functions.oauth2.inc.php`) → new `oauth2.added`, same text; then `OneTimeSecretDialog` titled `admin.oauth2_add_client`, described by `admin.oauth2_client_id` and the new client ID |
| Empty field | "Redirect/Callback URL cannot be empty" (hard-coded) → new `oauth2.redirectUriEmpty`, same text |
| Invalid URI | new `validation.format.redirectUri`; `tooLong` → `validation.tooLong` |

#### OAuth2 client page (`/identity-providers/oauth2-apps/:oauth2ClientId`, route `oauth2-client-detail`) → `templates/edit/oauth2client.twig`

| Element | Legacy key or source |
|---|---|
| Title | `OAuth2` (hard-coded `<h4>`) → new `oauth2.title`, with the client ID as the object's name |
| Read-only | `edit.client_id`, `edit.scope` |
| Editable | `edit.redirect_uri` |
| Save | `admin.save` |
| Saved | `success.object_modified` with the ID |
| Not found | UI 001's not-found page, back to the list with new `oauth2.backToList` |
| Secret | dropped (owner) |

#### Audit log (UI 001's screen, no legacy counterpart)

New `enums.auditEventType.*`, `enums.auditTargetType.*`, `enums.authMethod.*` and
`enums.auditFailureReason.*` labels for API 012's values, listed in `src/i18n/coverage.json`. The
target type `identityProvider` is labelled through `LEGACY_TEXTS` with `admin.iam`, and the auth
method `singleSignOn` with `admin.iam_sso`, where legacy has the same name; the rest are new
strings. Details use UI 001's generic view, which shows every documented key.

## API dependency and gaps

This feature depends on **mailcow-rest-v2 feature 012** (identity providers, single sign-on, OAuth2
clients). It also relies on API 001 (sign-in, sessions, public configuration, identity, audit log),
API 002 (audit target filters) and API 003 (mailbox templates, mailbox list filter by
authentication source).

**Pin** (UI 002 D1 policy, research R1): the planning baseline is commit
`32079252d55797d3da4e58ae661e9fb91c51c6f9`, whose bundle has sha256 `5201f7ed…850253b6` and 376
operations, 19 of them API 012's. API 012's contract files are unchanged there since `5c6f4e9`. At
implementation, T001 pins the release tag or the first commit at which API 012 is implemented and
its quickstart Part A passes, after diffing the API 012 contract files against the baseline
([contracts/README.md](./contracts/README.md)). The pin never moves backwards.

**API 012 closed every gap the spec first recorded**: per-source mailbox counts (FR-006, FR-015,
FR-017 there), the synchronisation status (FR-062), the provider-error report (FR-063), the
capabilities reads (FR-064), and bulk delete and revoke (FR-060, FR-061). The spec is aligned in its
clarification session "plan: alignment with the API 012 contract".

**Remaining API gaps**, recorded in the spec and **not worked around**. Per the API conventions
("Gaps found after planning"), they belong in mailcow-rest-v2's `docs/api-gaps.md`, where the
orchestrator assigns their numbers; this repository does not edit the API repository:

1. **No audit filter by sign-in method** (`authMethod` on `GET /audit-events`). API 012 FR-054
   forbids a feature-specific filter, but `authMethod` is an API 001 field, so a generic filter
   would serve every feature. Until then, each record shows its method and there is no filter
   (FR-067, US6-AS4).
2. **No audit filter by request ID**. A mailbox creation at sign-in refers to its sign-in record by
   request ID, but the record cannot be addressed. The app links to the account's sign-in records
   instead (FR-067).
3. **No create-only precondition** on `PUT /identity-provider` (`If-None-Match: *`). Concurrent
   first setups overwrite each other. The app reports a replacement when a first setup is answered
   `200` (FR-012).

**Coordination notes** for mailcow-rest-v2 (not gaps):

- **Return path**: `RESTV2_SSO_RETURN_PATH` must stay `/ng/sso/return`, the only path the static
  app serves. The app warns administrators when the reported return addresses differ (FR-027,
  R19). The API's documentation of the setting should say so.
- **UI 001 gap 5** (`KnownProblemType` not in the bundle) is closed at the baseline `3207925`, as
  UI 002 D1 records.
- **Dev stack Keycloak**: the `idp` profile's Keycloak needs a manual realm setup (API quickstart
  Part B). A realm import file in the API repository would let the single sign-on smoke test run in
  CI (owner question 2). *Settled at T101*: mailcow-rest-v2 imports `docker/keycloak/example-realm.json`
  (`bae8f34`, API gap G21), and the smoke suite runs the test with `SMOKE_IDP=1`.

## Dependencies on earlier UI features

UI 012 is implemented **after UI 001 to UI 011 and after API 012**. It relies on these building
blocks, named as the earlier plans name them. T002 confirms each one. A block that was built under
another name or path is used there, and the tasks' paths are adjusted. A missing block is built by
T002, test-first, at the listed path with the listed behaviour before any story starts.

| Building block | Path | Built by | Behaviour relied on |
|---|---|---|---|
| Contract pin implementing API 012 | `contract/VERSION.json` | T001 (UI 002 D1 policy) | the 19 operations and API 012's changes to API 001 (R1) |
| Coverage manifest | `src/i18n/coverage.json`, `scripts/i18n/check.mjs` | UI 002 (D2) | growing shared enumerations listed per feature; fully required enumerations for UI-introduced ones |
| Problem bodies | `src/api/problem.ts` | UI 001, as UI 002 reads `DomainNotEmptyProblem` members | the parsed problem body, so documented extension members can be read (`blockingMailboxes`, `mailboxCounts`) |
| Merge-patch requests | UI 002's section saves (`DomainPatch`) | UI 002 | PATCH with `application/merge-patch+json` and `If-Match` |
| `EditableSection.vue` | `src/shared/components/EditableSection.vue` | UI 002 (D11) | read and form slots; Edit only when editable; driven by the `edit` query parameter; one section at a time; full-screen with a sticky bar below `md`, in place above |
| `changedSince` | `src/shared/composables/useVersionedSave.ts` | UI 002 (D11) | on `412`: keep the input, refetch, mark the changed fields with their new values, "Save again" and "Discard" |
| `useLeaveGuard` | `src/shared/composables/useLeaveGuard.ts` | UI 002 (D21) | `useLeaveGuard(shouldGuard, messageKey)` on route leave, path changes and `beforeunload` |
| `ConfirmDialog` with `requireTyped` | `src/shared/components/ConfirmDialog.vue` | UI 002 | a typed value enables the confirm action; rich content |
| `useBulkSelection`, `BulkActionBar.vue`, `BulkResultSummary.vue` | `src/shared/composables/useBulkSelection.ts`, `src/shared/components/` | UI 002 (D22) | page-only selection reset by `onReset`; further selection disabled at the capabilities' bulk limit, with the limit stated; per-item results; failed, refused and outdated kept; Retry; "outcome unknown" |
| `HistoryLink.vue` and audit target filters | `src/shared/components/HistoryLink.vue`, `src/features/audit-log/list-state.ts` | UI 002 (D26) | `audit-log` with `targetType` and `targetId`, also without `targetId` |
| `OneTimeSecretDialog.vue` | `src/shared/components/OneTimeSecretDialog.vue` | UI 005 (promoted from `ApiKeySecretDialog`) | secret in local state; copy; confirmation on uncopied close, Escape and route leave; room for a second copyable value |
| `PasswordInput.vue`, `CopyButton.vue` | `src/shared/components/password/PasswordInput.vue`, `src/shared/components/CopyButton.vue` | UI 005 | masked input with a show/hide toggle (`aria-pressed`); copy with announcement |
| `CopyableValue.vue` | `src/shared/components/CopyableValue.vue` | UI 010 (R6) | a labelled value as wrapping text with a copy button and announcement |
| `useStatusMessage` | `src/shared/composables/useStatusMessage.ts`, `src/app/shell/StatusMessageHost.vue` | UI 011 (R8) | status messages that survive a navigation and stay until dismissed |
| "All templates" query and handlers | `src/features/mailboxes/templates-api.ts` (key `['mailbox-templates','all']`), `tests/mocks/handlers/mailbox-templates.ts` | UI 003 | `listMailboxTemplates` with `limit=1000&sort=name`; UI 012 adds a non-behavioural export to `src/features/mailboxes/index.ts` if needed |
| Mailbox routes | `mailboxes` (list parameter `source`), `mailbox-detail`, `mailbox-templates` | UI 003 | `/mailboxes?source=<type>` |
| Catalogue groups and the Cron log | `group: 'system'` in `src/app/navigation/catalogue.ts`; route `operations-log` with `logType` and `task` | UI 011 | the System heading; `{ name: 'operations-log', params: { logType: 'cron' }, query: { task } }`; `canAccess('logs')` |
| Audit log screen | `src/features/audit-log/` | UI 001, UI 002 | labels, detail rendering and filters, extended by US6 |

## Owner-level questions (defaults applied)

1. **Native review of the new strings.** Legacy keys are never translated by hand (constitution IV
   1.3.0): the upstream Slovak file lacks every `admin.iam_*` key, but those fall back to `en-gb`, and
   the FeldHost fork's `sk-sk` file has them. Only the new strings of the legacy form map are written
   in cs-cz and sk-sk. **Default**: the owner reviews them before the release, as constitution IV
   requires. `i18n:check` guarantees completeness only.
2. **Keycloak in CI for the single sign-on smoke test.** **Default**: the test is opt-in (it runs
   with `SMOKE_SSO_USERNAME` and `SMOKE_SSO_PASSWORD` against a Keycloak set up as API quickstart
   Part B describes). It becomes a CI gate once mailcow-rest-v2 ships a Keycloak realm import for its
   `idp` profile, which is proposed to that repository. *Settled at T101*: the realm import shipped
   (`bae8f34`); the CI `smoke` job sets `SMOKE_IDP=1`.

## Parity notes added by the plan

The spec's parity tables are complete. The plan adds:

1. Legacy's OAuth2 information text documents only the authorization code grant. The app shows it
   verbatim; listing the further grant types the capabilities read reports is "Deviations needing a
   decision" item 5 (R21).
2. The classic interface prefills the stored client secret and bind password in its form. The app
   also blocks browsers and password managers from filling these fields with the administrator's own
   saved sign-in (R14).

## Project Structure

### Documentation (this feature)

```text
specs/012-identity-providers-oauth2/
├── spec.md              # Feature specification (clarifications, parity, API dependency, gaps)
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R27
├── data-model.md        # Phase 1: consumed data, app models, query keys, routes, validation, state machines
├── quickstart.md        # Phase 1: setup, gates and validation guide
├── contracts/README.md  # Phase 1: pinned contract, operations used, problem types
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Only paths that this feature adds (+), changes (~) or deletes (−) are listed. Everything else is
UI 001's layout (001 plan) and the earlier features' code.

```text
docker/nginx/default.conf                         ~ location = /ng/sso/return (access_log off)
.github/workflows/ci.yml                          ~ image check of /ng/sso/return?code=x&state=y
scripts/i18n/check.mjs                            ~ fully required enumerations of API 012 (R26)
scripts/smoke/stack-up.sh                         ~ SMOKE_IDP=1 adds the API's idp profile
contract/{openapi.yaml,openapi.json,VERSION.json} ~ T001 pins the commit that implements API 012
src/
├── main.ts                                       ~ captureSingleSignOnReturn() first
├── api/
│   ├── index.ts                                  ~ API 012 root types and enumeration arrays
│   ├── csrf.ts                                   ~ identity-provider-session-ended on replay
│   └── query/{client.ts,keys.ts}                 ~ session reaction; identity-provider and oauth2-clients keys
├── app/
│   ├── router/guards.ts                          ~ meta.anySession
│   ├── navigation/catalogue.ts                   ~ identityProviders → available, group 'system'
│   └── session/{store.ts,session-end.ts,sign-out.ts} ~ notices ssoSessionEnded, signedOutSso
├── features/
│   ├── auth/
│   │   ├── index.ts, routes.ts, api.ts           ~ export capture; sso-return route; SSO mutations
│   │   ├── sso/{capture.ts,return-to.ts,return-classify.ts} +
│   │   ├── composables/{useSingleSignOnStart.ts,useSingleSignOnReturn.ts} +
│   │   ├── composables/usePasswordSignIn.ts      ~ 503 identity-provider-unavailable
│   │   ├── components/{SingleSignOnButton.vue,OrDivider.vue} +
│   │   ├── components/SignInNotice.vue           ~ two notices
│   │   ├── components/{SsoNotice.vue,IdpHint.vue} −
│   │   └── pages/{SignInPage.vue ~, SingleSignOnReturnPage.vue +}
│   ├── identity-providers/                       +
│   │   ├── index.ts, routes.ts
│   │   ├── components/SectionNav.vue
│   │   ├── provider/
│   │   │   ├── api.ts, form-model.ts, patch.ts, sections.ts, validation.ts,
│   │   │   │   secret-rule.ts, setup-steps.ts, connection-test.ts, usage.ts, sync-status.ts,
│   │   │   │   return-addresses.ts, conflict.ts
│   │   │   ├── composables/{useSetupFlow.ts,useConnectionTest.ts,useSectionEdit.ts}
│   │   │   ├── pages/{IdentityProviderPage.vue,IdentityProviderSetupPage.vue}
│   │   │   └── components/
│   │   │       ├── EmptyState.vue, OverviewHeader.vue, UsageSummary.vue, InUseMessage.vue,
│   │   │       │   TlsWarning.vue, SyncStatus.vue, ConnectionTestPanel.vue, ConnectionTestResult.vue
│   │   │       ├── sections/{ConnectionSection,DirectorySearchSection,ReturnAddressesSection,
│   │   │       │             SignInSection,SynchronisationSection}.vue
│   │   │       ├── fields/{KeycloakConnectionFields,OidcConnectionFields,LdapConnectionFields,
│   │   │       │           LdapDirectorySearchFields,ProviderSecretField,HostListField,
│   │   │       │           ConnectionSecurityChoice,
│   │   │       │           UrlListField,AppReturnAddressList,AttributeMappingField,TemplateSelect,
│   │   │       │           CreationFields,SynchronisationFields,SyncIntervalField}.vue
│   │   │       └── setup/{ProviderTypeStep,SetupProgress,SetupSectionIndex,SetupReview}.vue
│   │   └── oauth2/
│   │       ├── api.ts, list-state.ts, redirect-uris.ts, bulk.ts
│   │       ├── pages/{Oauth2ClientsPage.vue,Oauth2ClientCreatePage.vue,Oauth2ClientDetailPage.vue}
│   │       └── components/{Oauth2ClientList,Oauth2ClientCard,Oauth2ClientTable,Oauth2ClientFilters,
│   │                       TokenCounts,RedirectUriListField,Oauth2InfoPanel,ClientCredentialsDialog,
│   │                       Oauth2BulkActions}.vue
│   ├── mailboxes/index.ts                        ~ non-behavioural export of the "all templates" query, if missing
│   └── audit-log/
│       ├── labels.ts                             ~ API 012 values
│       └── components/details/{IdentityProviderDetails,Oauth2ClientDetails,ProviderSignInDetails}.vue +
├── shared/
│   ├── platform/storage.ts                       ~ sessionStorage mailcowui-ng.sso-return-to
│   └── validation/limits.ts                      ~ API 012 contract constants
└── i18n/
    ├── problems.ts                               ~ parameter-driven messages (R26)
    ├── messages/{en-gb,cs-cz,sk-sk}.json         ~ identityProviders, identityProvider, oauth2, auth.sso, …
    ├── coverage.json                             ~ API 012 values of the shared enumerations
    └── (no legacy copies: the data-model §8 keys are used verbatim, constitution IV 1.3.0)
tests/
├── mocks/
│   ├── factories/{identity-provider,oauth2-client,audit-identity-provider}.ts   +
│   ├── handlers/{identity-provider,single-sign-on,oauth2-clients}.ts            +
│   ├── handlers/{public-config,auth,identity,index}.ts                          ~
│   ├── scenarios/{identity-provider,single-sign-on,provider-password,oauth2-clients,
│   │              audit-identity-provider}.ts                                   +
│   ├── scenarios/{state,index}.ts                                               ~
│   └── server.ts                                 ~ request log records Referer
├── unit/
│   ├── features/auth/{sso/*,useSingleSignOnStart,useSingleSignOnReturn,SingleSignOnButton,
│   │                  SingleSignOnReturnPage}.spec.ts                            +
│   ├── features/auth/{SignInPage,usePasswordSignIn}.spec.ts                     ~
│   ├── features/identity-providers/{provider,oauth2}/*.spec.ts                  +
│   ├── features/audit-log/{labels,AuditEventDetails}.spec.ts                   ~
│   └── app/session/session-end.spec.ts, shared/platform/storage.spec.ts         ~
├── e2e/
│   ├── fixtures/provider.ts                                                     +
│   ├── identity-provider/{setup,connection-test,access,overview,section-edit,
│   │                      type-change-removal,reflow-and-keyboard}.spec.ts      +
│   ├── single-sign-on/{sign-in-screen,round-trip,session-end}.spec.ts           +
│   ├── sign-in/provider-password.spec.ts                                        +
│   ├── sign-in/sign-in-screen.spec.ts                                           ~ force SSO and hint rows
│   ├── oauth2-clients/{list,create,detail,bulk}.spec.ts                         +
│   ├── audit-log/identity-provider-history.spec.ts                              +
│   └── shell/storage-and-secrets.spec.ts                                        ~ SC-003
└── smoke/{identity-provider,provider-password,single-sign-on,oauth2-clients}.smoke.spec.ts +
     smoke/fixtures/identity-provider.ts +
```

**Structure Decision**: UI 001's single static frontend, organised by feature. The admin screens
form one feature folder that matches their catalogue entry. Single sign-on extends the `auth`
feature, because it shares the sign-in page and the landing logic. Cross-cutting session behaviour
stays in `src/app/session/` and `src/api/`, which own it since UI 001.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| *Resolved at T101: with the API's realm import the test runs with `SMOKE_IDP=1`, in CI too.* The single sign-on smoke test (a constitution VI required layer) is written and runnable, but runs only when `SMOKE_SSO_USERNAME` and `SMOKE_SSO_PASSWORD` are set, because the API dev stack's Keycloak realm is set up by hand (API quickstart Part B). | A real provider round trip cannot be scripted against a realm that does not exist. The LDAP and OAuth2 smoke tests run without manual setup. | Leaving the test out was rejected: VI requires the layer, and the test is ready for when a realm import exists (owner question 2). Mocking the provider in the smoke suite was rejected: that is the end-to-end suite's job. |
