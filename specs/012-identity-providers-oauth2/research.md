# Research: Identity Providers and OAuth2

**Feature**: `specs/012-identity-providers-oauth2` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

UI feature 001 settled the stack, the structure, contract pinning, the mock API, testing, i18n,
sessions and the shared primitives ([001 research](../001-sign-in-app-shell/research.md), R1–R29).
This document records only the decisions that are specific to feature 012. They follow this order of
precedence: the constitution, the pinned mailcow-rest-v2 contract, `docs/conventions.md`, UI 001's
decisions, then best practice. Each entry has a **Decision**, its **Rationale** and the
**Alternatives considered**.

---

## 1. Foundations

### R1. Contract pin and dependencies on earlier UI features

- **Decision**:
  - **Pin**: UI 012 needs a pin that contains the complete API 012 contract: 19 operations in the
    modules `identity-provider`, `oauth2-clients` and `single-sign-on`, plus API 012's additive
    changes to API 001 (`PublicConfig.externalIdentityProvider.singleSignOnAvailable`, the
    `AuthMethod` values, `IdentityAuthentication.identityProvider`, the `503` of `createSession`,
    the `identity-provider-session-ended` type of `Unauthorized`) and the audit target filters of
    API 002. The earliest such commit at planning time is mailcow-rest-v2
    **`a563357c9d1037bec3cdb548bfe33fe859abe138`** ("Record 011 analysis", 2026-10-18). Its
    Redocly 2.64.1 bundle has 376 operations and sha256
    `75ee9d1fcdbec547c8115d845a62aa6375530c502d40574f671cfd14b721fd82` (computed during planning).
    - UI 001 to UI 011 are implemented first and bump the pin for their own operations. Because
      mailcow-rest-v2 merges every feature's contract into one tree, their pin probably contains
      API 012 already. Task T001 therefore checks the pin first and bumps only when the pinned
      commit predates `a563357` or lacks one of the 19 operations. It never moves the pin backwards.
    - A later pin is fine when the 19 operations keep the shapes that
      [contracts/README.md](./contracts/README.md) lists; a changed shape is a deliberate bump with
      type fixes (constitution I).
    - UI 001's plan API gap 5 (`KnownProblemType` missing from the bundle) is still open at
      `a563357`: the fix sits uncommitted in the API working tree. The translation check keeps
      deriving problem types from the bundle text (001 R27).
  - **Building blocks from earlier UI features**. UI 012 reuses the patterns that UI 001 reserved
    (001 R20) and that later features build. The plan lists each with its expected path, the
    feature that builds it and the behaviour UI 012 relies on (plan, "Dependencies on earlier UI
    features"). Task T002 confirms each one. When one exists under another name or path, the tasks
    use it there. When one is missing, T002 builds it test-first at the listed path with the listed
    behaviour before any story starts, because a shared block may not be duplicated in a feature.
- **Rationale**: The constitution makes the pin a deliberate, recorded change. `info.version` stays
  `0.1.0` across features, so only the commit identifies the contract (001 R6). Naming each
  borrowed block with its contract makes the dependency testable instead of implicit.
- **Alternatives considered**: Pinning "the latest commit" at implementation time was rejected, as
  in 001 R6. Re-implementing the bulk, section-editing and secret-dialog patterns inside this feature
  was rejected by constitution VIII ("shared components appear after the second concrete use") and
  by `docs/conventions.md`, which wants one behaviour across features.

### R2. Code layout

- **Decision**:
  - The administrator screens live in **one feature folder, `src/features/identity-providers/`**,
    matching the catalogue entry `identityProviders`. It has two sub-areas, `provider/` (the
    identity provider configuration) and `oauth2/` (the OAuth2 clients), each with its own `api.ts`,
    `pages/` and `components/`, plus a shared `routes.ts`, `index.ts` and the section
    sub-navigation.
  - **Single sign-on lives in the existing `src/features/auth/`**, next to password and passkey
    sign-in: `auth/sso/` holds the return-parameter capture, the kept return address and the
    authorization address check; `auth/composables/` the start and return composables;
    `auth/components/SingleSignOnButton.vue`; `auth/pages/SingleSignOnReturnPage.vue`.
  - The session reactions (session end by the provider, the sign-out note) extend
    `src/app/session/` and `src/api/query/client.ts`, which own them since UI 001.
  - The audit log labels and detail renderers extend `src/features/audit-log/`.
- **Rationale**: One folder per catalogue entry keeps UI 001's rule that another feature is reached
  only through its `index.ts`. Single sign-on is a sign-in method: it shares the sign-in page, the
  landing logic after sign-in (`returnTo`, identity fetch, `session-changed` broadcast) and the
  notices with passkey and password sign-in, so a separate feature would import `auth` internals in
  both directions.
- **Alternatives considered**: Three folders (`identity-provider`, `oauth2-clients`,
  `single-sign-on`) were rejected: the two admin screens share one navigation entry and one
  sub-navigation, and single sign-on would need deep imports into `auth`. Putting everything into
  `auth` was rejected, because the admin screens have nothing to do with signing in.

### R3. Routes, navigation and the section sub-navigation

- **Decision**:
  - The catalogue entry `identityProviders` (path `/identity-providers`, administrators only, 001
    data-model §2) becomes `available`. `/identity-providers` redirects to the identity provider
    screen. Routes (full map in [data-model.md](./data-model.md#5-route-map)):
    - `/identity-providers/provider` (overview or empty state);
    - `/identity-providers/provider/setup` (setup flow; `?mode=change` for a type change,
      `?step=<name>` for the step on narrow screens);
    - `/identity-providers/oauth2-apps`, `/identity-providers/oauth2-apps/new` and
      `/identity-providers/oauth2-apps/:oauth2ClientId(\d{1,10})`. The numeric identifier matches
      UI 014's mapping M24 of the classic `/edit/oauth2client/{id}`.
    - `/sso/return`, under the base `/ng/`, in the auth layout (R5).
  - Every admin route carries `meta.navEntry: 'identityProviders'`, so `ShellLayout` renders
    `NoAccessState` for domain administrators and mailbox users without mounting the page and
    therefore without requests (001 R19, FR-002, SC-010).
  - A **section sub-navigation** (`SectionNav.vue`) at the top of both admin screens offers
    "Identity provider" and "OAuth2 apps" as two links with `aria-current="page"`. Two short links
    fit at 320 px without scrolling. A link is rendered only when its route is registered
    (`router.hasRoute`), so between the stories that add the two screens there is never a broken
    link (`docs/conventions.md`, "Where features meet").
- **Rationale**: FR-001 asks for one entry that leads to two screens. A sub-navigation reaches each
  screen in one tap from the other, while the flat catalogue of UI 001 stays unchanged. Fixed English
  paths give UI 014 stable targets.
- **Alternatives considered**: Two catalogue entries were rejected: the catalogue is the spec's
  one-entry-per-section list (001 SC-007). A hub page with two cards was rejected as one more tap on
  every visit. Tabs that swap content in one route were rejected: each screen needs its own address
  for reloads, deep links and Back.

---

## 2. Single sign-on

### R4. Starting single sign-on

- **Decision**: `useSingleSignOnStart()` (in `src/features/auth/composables/`) runs these steps when
  the user activates "Sign in with single sign-on":
  1. It sets a busy state that disables the action against a second start (FR-043) and announces
     "Opening your organisation's sign-in page" politely.
  2. It aborts any running WebAuthn ceremony through the single abort controller of 001 R14, because
     the page is about to be left.
  3. It calls `startSingleSignOn` (`POST /session/single-sign-on`, CSRF through the 001 middleware).
  4. It checks that `authorizationUrl` is an absolute `https:` or `http:` URL with `safeHref()`
     (001 R17). Any other value is treated as a generic failure and never navigated to.
  5. It keeps the requested in-app address for this tab: the `returnTo` of the sign-in route,
     validated with `validateReturnTo()` (001 R11), is written to `sessionStorage` key
     `mailcowui-ng.sso-return-to`. Without a valid value the key is removed. A storage failure is
     ignored (FR-043, FR-047, SC-011).
  6. It calls `window.location.assign(authorizationUrl)`: same tab, no pop-up, no frame (FR-044).

  Failures: `409 single-sign-on-not-available` shows "Single sign-on is not offered on this server",
  invalidates `['public-config']` and so hides the action (FR-043, edge case). Everything else is
  handled as in UI 001 (`ProblemMessage`, network message, CSRF retry).

  **Coming back with Back**: browsers may restore the sign-in page from the back-forward cache with
  the busy state still set. A `pageshow` listener with `event.persisted` resets the busy state and
  lets UI 001's conditional passkey request restart (it already restarts on `visibilitychange`). A
  page that is reloaded instead starts fresh. Either way every sign-in action is usable again
  (FR-043, edge case "Browser Back").

  **Stale kept address**: the sign-in page removes `mailcowui-ng.sso-return-to` when it mounts, so
  a value left behind by an abandoned round trip never steers a later return.
- **Rationale**: The API returns a ready authorization address with state and PKCE (API research
  R4); the app only navigates. `sessionStorage` is per tab, survives the round trip, disappears with
  the tab, and holds no credential, so constitution V allows it (spec clarification 3). Checking the
  scheme closes the `javascript:` vector even though the address comes from the API.
- **Alternatives considered**:
  - Putting the requested address into the provider round trip (for example in `state`): rejected,
    because the API owns the state and the return address.
  - `localStorage`: rejected; it outlives the tab and leaks the address into other tabs.
  - A pop-up window: forbidden by FR-044 and broken on many phones.

### R5. The return landing: capture and strip before anything else

- **Decision**:
  - `src/features/auth/sso/capture.ts` exports `captureSingleSignOnReturn()`. `src/main.ts` calls it
    as its first statement, **before** the router is created and before the bootstrap sends
    `GET /csrf-token`.
    - When `location.pathname` equals `import.meta.env.BASE_URL + 'sso/return'`, it reads the first
      `code`, `state` and `error` values from the query into a module-level variable. Every other
      parameter (`error_description`, `error_uri`, `session_state`, `iss`) is dropped unread.
    - It then calls `history.replaceState(history.state, '', location.pathname)`, which removes the
      query and any fragment from the address bar and from the current history entry (FR-046).
    - `takeCapturedSingleSignOnReturn()` returns the captured values once and clears them, so a
      second mount of the page, or a reload, finds nothing (edge case "Reload of the return
      screen").
  - Order matters: browsers send the page address as `Referer` on same-origin requests, so stripping
    after the bootstrap would put the code and state into the API requests' headers and possibly
    into access logs. Stripping first leaves `Referer: …/ng/sso/return`. The end-to-end tests assert
    this through the mock's request log, which records the `Referer` header (R24, SC-003).
  - The **document request** itself (`GET /ng/sso/return?code=…&state=…`) is made by the browser
    when the provider redirects, as in every OAuth 2.0 flow. The code is single-use and bound to the
    session's PKCE verifier, so it is useless to a log reader. The app's image adds a
    `location = /ng/sso/return` block with `access_log off` (still serving `index.html` with the
    security headers). nginx-mailcow's own access log is outside this repository.
  - The route `sso-return` (`/sso/return`) is allowed in **every session state**
    (`meta.anySession: true`, a new rule in `src/app/router/guards.ts`): the page itself decides what
    happens, because a code may arrive while another tab already signed in (edge case).
  - The page renders in `AuthLayout` with the operator's branding (`SignInHeader`), an `<h1>`
    "Completing sign-in", a progress indicator and a polite announcement (FR-045).
- **Rationale**: FR-046 requires the parameters to be removed "before anything else happens" and
  never sent anywhere other than the completion request. Capturing synchronously in the entry module
  is the only point that precedes every request. The capture module is a few hundred bytes, so the
  entry budget is unaffected (R27).
- **Alternatives considered**:
  - Reading the parameters in the route component: rejected; the bootstrap requests would already
    have carried them in `Referer`.
  - A `<meta name="referrer" content="no-referrer">` in `index.html`: rejected; it would change the
    policy for the whole app, and it would not remove the values from the address bar or history.
  - A server-side redirect that strips the query: rejected; the build is static (constitution).

### R6. Completing, reporting and the outcomes

- **Decision**: `useSingleSignOnReturn()` decides from the captured values:

  | Captured | Request | Next |
  |---|---|---|
  | `code` (1–4,096 characters) and `state` (1–512), no `error` | `completeSingleSignOn` once | outcome table below |
  | `error` and `state`, the error matching the contract pattern `^[\x20-\x21\x23-\x5B\x5D-\x7E]{1,64}$` | `reportSingleSignOnProviderError` with `{ error, state }` | "cancelled or refused" message, whatever the report's outcome |
  | `error` without a usable `state`, or an error code outside the pattern | `cancelSingleSignOn` | "cancelled or refused" message |
  | `code` without `state`, `state` without `code`, or a value over its length limit | `cancelSingleSignOn` | "sign-in state invalid" message |
  | nothing | none | an `active` session opens `home`; otherwise `sign-in` without a message (FR-049) |

  The provider's `error_description` is never read, shown or sent (FR-048). Sending values outside
  the contract's limits would only earn a `422`; cancelling discards the pending sign-in instead.

  **Kept address**: at mount the page reads `mailcowui-ng.sso-return-to` and removes it at once
  ("read and discarded on return", FR-043), keeping the value in component memory for the outcome.

  **Completion outcomes**:

  | Response | App behaviour |
  |---|---|
  | `201` `SessionCreated` (`active`, `authMethod: singleSignOn`) | Exactly as after any sign-in of UI 001: write `['session']`, fetch `['identity']`, broadcast `session-changed`, then `router.replace` to the kept address if `validateReturnTo()` accepts it, otherwise `home` (FR-047). `replace` keeps the return page out of history. |
  | `401 sign-in-state-invalid` | "The sign-in expired or was already completed"; Try again, Back to sign-in |
  | `401 sign-in-failed` | Generic "did not succeed, contact the administrator if it persists"; no reason (US2-AS6) |
  | `503 identity-provider-unavailable` | "The organisation's sign-in service is not reachable"; Try again, Back to sign-in |
  | `409 single-sign-on-not-available` | "Single sign-on is not offered"; invalidate `['public-config']`; Back to sign-in only |
  | `403` (CSRF after the silent retry), `422`, `400`, `500`, network failure | As in UI 001: `ProblemMessage` with the request ID, network message; Try again, Back to sign-in |

  - **Try again** starts a new single sign-on through `useSingleSignOnStart()` with the kept address
    held in memory; it never resubmits the old code and state (FR-048, API `sign-in-state-invalid`
    client action).
  - **Back to sign-in** opens `sign-in` with `?returnTo=<kept address>`, so a password or passkey
    sign-in still lands on the requested page.
  - Outcome messages move focus to the message heading and are announced assertively; the progress
    state is announced politely (FR-070, FR-073).
  - No second-factor step and no pending actions follow a single sign-on (API 012 FR-024); if the
    session were ever `pendingSecondFactor` or `restricted`, the guard of 001 R11 routes it as usual.
- **Rationale**: The table follows the contract's documented responses one to one. Reporting the
  provider error gives administrators an audit record with the provider's error code (API 012
  FR-063), and keeping the message independent of the report avoids a confusing "state invalid"
  after a user simply pressed "Cancel" at the provider.
- **Alternatives considered**: Calling `cancelSingleSignOn` for every provider error (the spec's
  first draft): superseded by the report operation. Showing the provider's `error` code to the user:
  rejected; it is untranslated technical text (FR-048). Auto-retrying a failed completion: rejected,
  because the state is consumed by the first attempt.

### R7. Sign-in screen composition and "force single sign-on"

- **Decision**: `SignInPage.vue` (UI 001) composes its methods from three inputs: the screen's role,
  `publicConfig.externalIdentityProvider.singleSignOnAvailable` with
  `publicConfig.loginPage.forceSingleSignOn`, and `passkeysSupported`.

  | Screen | SSO available | Force SSO | Passkeys supported | Shown, in this order |
  |---|---|---|---|---|
  | Role-neutral or mailbox user | no | either | yes | passkey, "or", password form, "Forgot password?" |
  | Role-neutral or mailbox user | no | either | no | password form, "Forgot password?" |
  | Role-neutral or mailbox user | yes | no | yes | passkey, single sign-on, "or", password form, "Forgot password?" |
  | Role-neutral or mailbox user | yes | no | no | single sign-on, "or", password form, "Forgot password?" |
  | Role-neutral or mailbox user | yes | yes | yes | passkey, single sign-on |
  | Role-neutral or mailbox user | yes | yes | no | single sign-on |
  | Administrator or domain administrator | either | either | either | as in UI 001: passkey (when supported), "or", password form; never single sign-on |

  The "Not the correct login?" links of UI 001 FR-006 and the app links are shown in every row.
  - The single sign-on action is a full-width secondary button below the passkey action (FR-040).
  - UI 001's **`SsoNotice.vue`** (the force-SSO notice pointing to the classic interface) and
    **`IdpHint.vue`** (the "cannot use your password here yet" hint, UI 001 FR-008) are deleted,
    and UI 001's tests that assert them are rewritten to the new expectations first (FR-041, FR-042).
    "Force single sign-on" without available single sign-on no longer hides the form: the option is
    ignored (spec clarification 2).
  - The "or" divider, used twice now, becomes `src/features/auth/components/OrDivider.vue`
    (decorative text inside a `role="separator"` element with an accessible label).
- **Rationale**: This is the spec's clarified order, which keeps passkeys first (owner decision in
  UI 001) and replaces only the notice of UI 001 FR-007. The API describes the option as
  display-only (`LoginPageOptions.forceSingleSignOn`).
- **Alternatives considered**: Keeping `SsoNotice` for the unavailable case: rejected, because the
  spec ignores the option then, and the notice would send users to a classic page that also cannot
  sign them in.

### R8. Password sign-in through a provider

- **Decision**: LDAP and Keycloak mailboxes use UI 001's password form unchanged (FR-050). One branch
  is added to `usePasswordSignIn`: `503 identity-provider-unavailable` shows "Your organisation's
  sign-in service is not reachable. Try again in a few minutes.", keeps the username, clears the
  password, moves focus to the message and does **not** start a countdown, although the response
  carries `Retry-After` (FR-051: no delay of a retry). `authMethod` values such as
  `directoryPasswordAndSecondFactor` need no handling: the second-factor step and the
  pending-actions screen follow `Session.state` as for any account (US3-AS1, US3-AS4).
- **Rationale**: The contract documents the `503` exactly for this case, and the spec forbids the
  wrong-password wording and an artificial wait.
- **Alternatives considered**: Honouring `Retry-After` with a countdown: rejected by FR-051.

### R9. End of a single sign-on session and the sign-out note

- **Decision**:
  - `identity-provider-session-ended` (401) joins `unauthenticated` in the session reactions of
    `src/api/query/client.ts` and in the CSRF replay path of `src/api/csrf.ts`. It ends the session
    as in UI 001 (`queryClient.clear()`, `returnTo` = current path, sign-in route, fresh CSRF token)
    with the new one-shot notice **`ssoSessionEnded`**: "Your single sign-on session ended, for
    example after signing out at your organisation or a change there. Sign in again to continue."
    The sign-in screen offers the single sign-on action when it is available. The app never sends
    the browser to the provider on its own (FR-052).
  - **Sign-out**: before `DELETE /session`, `sign-out.ts` reads the cached identity's
    `authentication.method`. For `singleSignOn` the confirmation notice becomes **`signedOutSso`**:
    "You are signed out of this app. You are still signed in at your organisation's sign-in service;
    sign out there too on a shared device." (FR-053).
- **Rationale**: Both are one-shot notices of UI 001's session store, so no new mechanism is needed.
  Reading the method before the cache is cleared is the only way to know it afterwards.
- **Alternatives considered**: Redirecting to the provider after a session end (legacy behaviour):
  rejected by FR-052. Signing out at the provider: out of scope (API 012 FR-027).

---

## 3. Identity provider administration

### R10. Loading: capabilities, configuration and templates

- **Decision**:
  - `['identity-provider', 'capabilities']` (`getIdentityProviderCapabilities`, `staleTime` 5 min):
    defaults, limits, provider types and what each offers, the app's return addresses and the
    configured type. Invalidated after every save and removal.
  - `['identity-provider', 'configuration']` (`getIdentityProvider`, `staleTime` 30 s). The query
    function maps `404 identity-provider-not-configured` to `null`, so "not configured" is a normal
    state that renders the empty state, never an error (FR-004). Any other failure is the error
    state with retry.
  - The overview requests both in parallel. The setup flow needs only the capabilities, plus the
    configuration in type-change mode (for its version tag and counts).
  - **Mailbox templates** for the mapping and the default template come from `listMailboxTemplates`
    (API 003) under UI 003's query key root, fetched only when a mapping field or the default
    template choice mounts. All templates are loaded, in pages of 1,000 (the API maximum) until
    `meta.total` is reached, normally one request. A failure shows an error with retry next to the
    mapping and keeps the entered entries (edge case).
  - No polling. The synchronisation status refreshes when the overview is opened again after the
    stale time, or after a save (constitution VII, 001 FR-033).
- **Rationale**: The capabilities read exists so that a client can render the setup before anything
  is stored (API 012 FR-064). Treating the documented `404` as data keeps the empty state free of
  error styling.
- **Alternatives considered**: Hard-coding the defaults and limits: forbidden by
  `docs/conventions.md` ("never hard-codes them"). Server-side template search on every keystroke:
  unnecessary for the few templates a server has, once they are all loaded.

### R11. Form model and request building from generated types

- **Decision**: `src/features/identity-providers/provider/form-model.ts` holds the editable state as
  a discriminated union over `type`, **derived from the generated input types** with TypeScript
  mapped types (constitution I: no hand-written API shapes):
  - `KeycloakForm`, `OidcForm` and `LdapForm` make every member of the corresponding
    `IdentityProvider…Input` required and non-nullable for editing (`''` for "empty"), keep the
    secret as a string (`''` = not typed), and for LDAP replace `useSsl` and `useStartTls` with one
    UI-only field `connectionSecurity: 'none' | 'ssl' | 'startTls'` (FR-019).
  - Pure functions, each unit-tested and checked against the contract with the mock validator's
    request validation:
    - `formFromDefaults(type, capabilities.defaults)` (FR-011);
    - `formFromConfig(config)`, where stored `null` values become `''` and missing settings stay
      empty;
    - `toInput(form)` → `IdentityProviderInput` for `saveIdentityProvider` and
      `testIdentityProviderConnection`: strings trimmed; empty host and URL entries removed; an
      empty `filter`, `attributeField` or `defaultTemplate` sent as `null`; `connectionSecurity`
      mapped back to the two booleans; the secret omitted when `''`; read-only members
      (`appReturnUrls`, `effectivePort`, `complete` and so on) never sent, because the API refuses
      them with `conflictsWith`;
    - `toPatch(section, config, form)` → `IdentityProviderPatch` or `null` (R13);
    - `toCandidate(context)` for the connection test (R16).
  - Mapping entries with a missing value or template are errors, never silently dropped (legacy
    parity row "Attribute Mapping").
- **Rationale**: One model serves the setup, the section edits and the test, so the three cannot
  drift. Validating the built bodies against the contract in unit tests catches shape errors that
  types cannot express (patterns, `unevaluatedProperties`).
- **Alternatives considered**: A form library: rejected (001 R1). Binding inputs directly to the API
  representation: rejected; the representation has nullable and read-only members that a request
  must not echo.

### R12. Setup flow: steps on phones, one page on wide screens

- **Decision**:
  - `IdentityProviderSetupPage.vue` owns one `useSetupFlow()` instance (form, validation, test result,
    furthest valid step). The layout depends on the viewport:
    - **Below `lg` (1024 px)**: steps. Keycloak and generic OIDC have five (type; connection and
      credentials; return addresses; sign-in and mailbox creation with synchronisation for Keycloak;
      review). LDAP has four (type; connection and credentials with the directory search; sign-in
      and mailbox creation with synchronisation; review), so its progress reads "Step 2 of 4".
    - **From `lg` up**: the same step components on one page, below a sticky section index
      (`<nav aria-label>` with in-page links), with Review and Save at the end (FR-009 "MAY").
    Resizing between the layouts keeps every entry, because the state lives in the composable.
  - The current step is in the address as `?step=type|connection|return-addresses|sign-in|review`.
    "Next" and "Back" use `router.push`, so the browser's Back button returns to the previous step.
    A step later than the furthest validated one is normalised with `router.replace` to that step, and
    a reload (which loses the in-memory entries, secret included) starts at the type step.
  - "Next" validates the step's fields (R15). With errors, focus moves to the error summary and the
    step does not advance (US1-AS5). On success the next step's `<h2 tabindex="-1">` receives focus
    and the polite region announces "Step 3 of 5: Return addresses" (FR-073).
  - Progress is text ("Step 2 of 5") plus an `<ol>` of step names with `aria-current="step"`; on
    320 px only the text and the current name show.
  - Leaving the page with any entry or a chosen type asks for confirmation through
    `useUnsavedChangesGuard` (route leave and `beforeunload`, FR-016). Unmounting discards the state,
    secret included (FR-026).
  - **Type change** (`?mode=change`): the overview confirmed first (FR-013). The page reads the
    configuration for its version tag and counts; in the type step the current type and every
    blocked type (R17) are disabled with their reason. Save sends `If-Match`.
  - **Save** (`saveIdentityProvider`, PUT):
    - first setup without `If-Match` → `201`: announce "Identity provider set up";
    - first setup answered `200`: announce that an existing configuration was replaced (API gap 3);
    - type change → `200`: announce "Provider type changed".
    In every success case the app writes `['identity-provider','configuration']`, invalidates the
    capabilities and `['public-config']` (FR-012) and replaces the route with the overview.
    Failures:
    - `409 identity-provider-in-use`: the in-use message of R17, nothing changed (FR-014);
    - `412`: the configuration was changed elsewhere; the entries are kept, the configuration and its
      tag are reloaded, and the administrator saves again or leaves;
    - `422`: each error goes to its field, and the summary names the step of each error with a link
      that opens that step;
    - network failure: nothing is reported as saved, and the entries stay for a retry.
- **Rationale**: Constitution II forbids giant forms on phones. Steps in the address make Back
  behave as users expect. The single page on wide screens follows the spec's clarification and
  reuses the same components, so both layouts share all logic and tests.
- **Alternatives considered**: Steps on every viewport (allowed by the "MAY"): rejected, because the
  clarification chose one page for wide screens and a stepper wastes a desktop's space. Keeping the
  step in component state only: rejected, because Back would leave the flow. A dialog-based wizard:
  rejected by constitution II.

### R13. Section editing and outdated saves

- **Decision**:
  - Each section of FR-006 (connection and credentials, directory search, return addresses, sign-in
    and mailbox creation, synchronisation; per type as the table in data-model §2 lists) is an
    `EditableSection` (UI 002): read-only values, an Edit action, full-screen below `md` and in place
    above (FR-015). **One section is in edit at a time**; opening another while one has changes asks
    to save or discard first, so a section never saves against a version tag that the app's own
    other save just made outdated.
  - Save builds `toPatch(section, config, form)`. It contains only that section's members whose
    normalised value differs from the stored one, arrays as whole lists (`hosts`, `attributeMapping`,
    `additionalReturnUrls`), and the secret only when typed. `null` means nothing changed: the edit
    closes without a request. Otherwise `updateIdentityProvider` is sent (PATCH,
    `application/merge-patch+json`, `If-Match: config.etag`).
  - `200`: write the response into the cache. The section shows the stored, possibly normalised,
    values (FR-015), the secret field is emptied and "Section saved" is announced.
  - `412` (`useVersionedSave` with the field diff of UI 002): the entries are kept, the configuration
    is refetched, and every setting of the section whose stored value changed is marked with its new
    value (FR-017). Secrets: only a change of `clientSecretSet` or `bindPasswordSet` is visible. When
    the tag changed but no visible setting of the section differs, the message says that the
    configuration changed elsewhere, possibly a secret, and the administrator saves again with the
    new tag or discards. Never merged or re-sent automatically.
  - `422`: errors on members of the open section are shown at their fields. Errors on members of
    another section (for example `attributeField` with `conflictsWith` while turning on the
    synchronisation) appear in the error summary, naming that section with a link to edit it.
  - `404 identity-provider-not-configured`: the configuration was removed elsewhere. The edit closes,
    the cache is set to `null` and the empty state explains it.
- **Rationale**: This is UI 002's established section pattern and `docs/conventions.md` "Editing and
  conflicts". JSON Merge Patch with whole arrays is how the contract defines the change.
- **Alternatives considered**: Several sections in edit at once, rebasing the second onto the first's
  new tag: rejected as an automatic merge, which the conventions forbid. A whole save for every
  section: rejected; it would send other sections' settings and lose the version check's precision.

### R14. Write-only secrets

- **Decision**: The client secret and the bind password use `WriteOnlySecretField` (R1) in a mode
  without "remove" (FR-024: there is no removal action):
  - The field starts empty. The status reads "Set" or "Not set" from `clientSecretSet` or
    `bindPasswordSet`; in the setup flow it reads "Required".
  - The field is masked, with a labelled reveal toggle (`aria-pressed`), and carries
    `autocomplete="new-password"`, `autocapitalize="none"`, `spellcheck="false"` and the
    password-manager opt-outs `data-1p-ignore`, `data-lpignore="true"` and `data-bwignore`, so that
    browsers do not fill in the administrator's own saved sign-in (FR-026).
  - `secret-rule.ts` decides when it is required, with a visible reason:
    - in the setup flow: always (`noStoredSecret`);
    - in an edit or a test: when the type differs from the stored type (`typeChanged`), or when the
      address that receives the secret differs from the stored one (`addressChanged`): the Keycloak
      `serverUrl`, the generic OIDC `tokenEndpoint`, or the LDAP `hosts` compared as an ordered list
      after trimming.
    The reasons match the API's `secretRequired` reasons, whose translations are reused (FR-025,
    FR-034).
  - The value is emptied after a successful save, a refused save, a cancelled edit and when the
    form unmounts (FR-026). It exists in component state and in the request body only. The secret
    mutations use `gcTime: 0`, so TanStack Query drops their variables as soon as they settle. The
    value is never written to the query cache, the address, history state or storage (SC-003).
- **Rationale**: This is the conventions' write-only pattern, minus removal, which the API does not
  offer. Comparing the hosts in order is at least as strict as the API's check, so the app never
  sends a request that the API would refuse for a missing secret.
- **Alternatives considered**: `autocomplete="off"`: rejected; browsers ignore it for password
  fields. Keeping mutations at the default `gcTime`: rejected, because the variables would keep the
  secret in memory for five minutes.

### R15. Client-side rules and limits

- **Decision**: `provider/validation.ts` checks FR-018 before every step advance, section save and
  test. The full table is in [data-model.md](./data-model.md#6-client-side-validation). The sources
  are:
  - **numeric limits** from `capabilities.limits`: `attributeMappingMaxEntries`,
    `attributeValueMaxLength`, `additionalReturnUrlsMaxEntries`, `urlMaxLength`,
    `ldapHostsMaxEntries`, `syncIntervalMinMinutes`, `syncIntervalMaxMinutes`, `secretMaxLength`,
    `scopesMaxEntries`, `distinguishedNameMaxLength` and `filterMaxLength`;
  - **contract-only limits** (realm, client ID and template name 255; Keycloak version 64;
    host 253; port 1–65,535) as constants in `src/shared/validation/limits.ts`, each compared with
    its `maxLength`, `maximum` or `pattern` in `contract/openapi.json` by UI 001's limits test;
  - **syntax rules** written from the contract's patterns and format descriptions:
    - `httpUrl`: `URL` parses it and the protocol is `http:` or `https:`;
    - `keycloakRealm`: no `/`;
    - `keycloakVersion`: `^[0-9]+(\.[0-9]+){0,3}$`;
    - `scopeList`: 1 to `scopesMaxEntries` names separated by single spaces, each of printable
      characters other than space, `"` and `\`;
    - `hostName`: through the shared `isHostName()`, which also accepts IPv4 and IPv6;
    - `ldapAttribute`: `^[A-Za-z][A-Za-z0-9-]*$`;
    - `ldapFilter`: empty, or it starts with `(`, ends with `)` and has balanced parentheses (LDAP
      escapes literal parentheses as `\28` and `\29`, so raw parentheses can be counted);
    - `attributeField` required while user import or periodic synchronisation is on, shown at the
      synchronisation switch with a link to the field;
    - duplicates: the attribute values with letter case counting, and the additional return URLs
      compared exactly.
  - Messages use UI 001's `validation.<code>` keys with the same parameters the API would send
    (`tooLong` `max`, `tooMany` `max`, `invalidFormat` `format`, `duplicate` `duplicateOf`), so a
    client-side and a server-side error read the same.
- **Rationale**: `docs/conventions.md` requires limits from the capabilities read, and UI 001
  already guards contract constants with a test. Mirroring the API's codes keeps one translation
  per rule.
- **Alternatives considered**: Validating with Ajv against the contract in the browser: rejected; it
  would add about 30 KB to the feature chunk and produce messages without field context.

### R16. Connection test

- **Decision** (`useConnectionTest()`, `connection-test.ts`, `ConnectionTestPanel.vue`):
  - **Where** (FR-033): in the setup flow's connection step, in the connection section's edit and on
    the overview. On the overview it is unavailable, with the reason, while the configuration is
    incomplete, because the stored values cannot form a valid candidate.
  - **Candidate** (FR-034):
    - setup: `toInput(form)`;
    - connection edit: `toInput(merge(formFromConfig(config), sectionForm))`;
    - overview: `toInput(formFromConfig(config))`.
    The secret is omitted unless typed. Before sending, `secret-rule.ts` decides: when the secret is
    required (R14) and empty, the secret field is marked with its reason and nothing is sent.
    Client validation errors are shown at their fields and nothing is sent (FR-038).
  - **Request**: `testIdentityProviderConnection` with an `AbortController`. A `setTimeout` of
    90 seconds aborts it and shows "No result was received" with "Test again" (FR-035). A
    `setTimeout` is used rather than `AbortSignal.timeout`, so that the end-to-end tests can drive
    it with `page.clock`. The longest legitimate test, ten LDAP hosts at the reported
    `providerTimeoutSeconds` of 7, stays below 90 seconds. An aborted test may still finish and be
    audited on the server, which is harmless, because a test changes nothing.
  - **Busy**: a progress state, announced politely; the action is disabled until the result arrives.
  - **Result** (FR-036, FR-037): the outcome as text plus an icon with a text alternative; for a
    failure, the translated category with its hint; for `unexpectedResponse`, the provider status;
    always the provider type, the tested address (wrapping text) and the test time (`DateTime`). A
    successful Keycloak test notes, when the mailpassword flow, user import or periodic
    synchronisation is on, that the `view-users` permission was not checked.
  - **Staleness**: the panel keeps, in memory, the values of the candidate members that the test
    depends on (data-model §2, `TEST_DEPENDENCIES`: the connection members of the type, the secret
    and `ignoreTlsErrors`). When any of them changes, the result shows "Refers to earlier values".
  - Results are component state only and are discarded when the page or form unmounts. A failed or
    missing test never blocks saving (FR-037). The review step shows the latest result with its
    staleness (FR-012).
  - `422` from the API is mapped to the fields; a network failure shows the network message with
    retry, and nothing is stored (edge case).
- **Rationale**: The contract tests unsaved candidates and treats the test as an action. The 90
  second limit is the spec's own requirement and the only client-side timeout in the app, which
  001 R8 otherwise forbids (it protects deliberately delayed sign-in answers, which this is not).
- **Alternatives considered**: Running a test automatically before every save: rejected by FR-037.
  Comparing whole candidates for staleness: rejected; a change to the mapping does not make a
  connection result stale.

### R17. Usage counts: removal, type change and links

- **Decision**: `provider/usage.ts`, a pure module over `config.mailboxCounts` (per external source,
  API 012 FR-006):
  - `total = keycloak + genericOidc + ldap`. **Remove** is available only when `total` is 0
    (FR-039); otherwise unavailable, with the reason and the links.
  - `blocked(T)` holds when the counts of every source other than `T` add up to more than 0.
    **Change provider type** is available when at least one type other than the configured one is
    not blocked (FR-013). In the type step each blocked type is disabled with "N mailboxes still
    authenticate against <source>".
  - **Display** (FR-005): the configured type's count first ("No mailbox uses it yet" for 0), then
    each other source with a non-zero count, explained as left by the classic interface and blocking
    removal. Each count links to UI 003's mailbox list filtered by that source
    (`/mailboxes?authSource=<type>`; the parameter name follows UI 003's list state).
  - **`409 identity-provider-in-use`** on a save or removal (FR-014): `InUseMessage.vue` reads
    `blockingMailboxes` and `mailboxCounts` from the problem through the typed extension-member guard
    of R1, says that nothing changed and shows the same links. The cached configuration is refetched,
    because its counts were evidently outdated.
- **Rationale**: The API counts exactly as its refusals count, so the app can predict every refusal
  instead of relying on the conflict (this closes the spec's former gap). The conflict remains the
  authority when counts changed in the meantime.
- **Alternatives considered**: Offering the actions and relying on the `409`: rejected by FR-013 and
  FR-039, which want the reason shown up front.

### R18. Synchronisation status and the job-log link

- **Decision** (`sync-status.ts`, `SyncStatus.vue`, FR-020):
  - `synchronisation.state` maps to a text label and an icon with a text alternative:
    - `disabled`: "Off: neither user import nor periodic synchronisation is on";
    - `running`: "A run is in progress";
    - `waiting`: "Waiting for the next run";
    - `overdue`: "Overdue: the next run was expected but has not started";
    - `unknown`: "No run found in the scheduled-job log".
    `overdue` and `unknown` carry a warning icon and explain that failures the jobs do not log show
    only as an overdue run, and that the log keeps a limited number of entries.
  - `lastCompletedAt` and `lastFailedAt` are shown with `DateTime` (absolute) and
    `nextRunExpectedAt` with `RelativeTime`. `null` values read "None".
  - The interval reads as a duration: whole days when the minutes divide by 1,440, otherwise whole
    hours when they divide by 60, otherwise minutes. Units are formatted with `Intl.NumberFormat`
    (`style: 'unit'`, `unitDisplay: 'long'`) inside "every {duration}".
  - **Job-log link**: UI 011 ships before UI 012, so the section links to UI 011's Cron log filtered
    by the task `Keycloak Sync` or `LDAP Sync` (the `task` values the legacy jobs write, API 012
    data model). The link is resolved through UI 011's route name and rendered only when that route
    exists and `canAccess('operations')` holds, so it can never be broken.
- **Rationale**: The API derives the status and documents its limits (API 012 FR-062). Saying them
  avoids false confidence in "waiting" and false alarm at "unknown".
- **Alternatives considered**: Polling the status: rejected (001 FR-033, constitution VII). Showing
  raw state codes: rejected (FR-075, constitution IV).

### R19. Return addresses and the return-path check

- **Decision**:
  - The app's return addresses come from `config.appReturnUrls` on the overview and from
    `capabilities.appReturnUrls` in the setup flow (FR-027). Each is shown as wrapping text in a
    `<code>` element, never as a link (FR-082), with a `CopyValue` action that announces success and
    selects the text with an explanation when the clipboard is refused (FR-076).
  - `return-addresses.ts` compares each address's `pathname` with
    `import.meta.env.BASE_URL + 'sso/return'` (`/ng/sso/return`). On a mismatch the section warns:
    "These return addresses do not lead to this app's sign-in return page. Single sign-on in this
    app fails until the server's return path (`RESTV2_SSO_RETURN_PATH`) is set back to
    `/ng/sso/return`." (FR-027).
  - The classic interface's return URL and the additional return URLs are edited as a required field
    and a list of entries (FR-028).
- **Rationale**: The API's return path is configurable (`RESTV2_SSO_RETURN_PATH`, default
  `/ng/sso/return`), but a static app serves only the routes it was built with. A visible warning
  turns a silent provider error into an actionable message for the one role that can fix it.
- **Alternatives considered**: Serving any path the API might report: impossible for a static build
  and unsafe. Exposing the path in the public configuration: unnecessary while the default is the
  only supported production value.

### R20. Attribute mapping and template choice

- **Decision**:
  - `AttributeMappingField.vue` edits the mapping as a list of entries (FR-029). Below `md` each
    entry is a card with the attribute value and the template stacked and a remove action labelled
    "Remove entry {value}". From `md` up, entries are two-column rows. "Add entry" is offered up to
    `attributeMappingMaxEntries`, and adding focuses the new entry's value field.
  - The help text of FR-030 to FR-032 is visible text tied to the fields with `aria-describedby`.
  - `TemplateSelect.vue` offers the loaded templates (R10). With up to 15 templates it is a native
    `<select>`. With more, it is a Reka `Combobox` without `ComboboxViewport` (001 R18), filtering
    the loaded list client-side by name (FR-029 "a search when there are many templates").
    - A stored template that no longer exists is kept as the current choice, labelled "Template
      missing" (FR-007).
    - The default template adds a "None" choice (FR-031).
    - With no templates at all, the mapping cannot get entries; the field says so and links to
      UI 003's mailbox templates screen (edge case).
- **Rationale**: Cards on phones follow constitution II. Client-side filtering is legitimate here,
  because the full list is loaded, which is not the case for paged lists (R23).
- **Alternatives considered**: Always a combobox: rejected; a native select is simpler and better on
  phones for a handful of templates. A shared template picker: none exists yet, and this is its
  first use. UI 003 may promote it later.

---

## 4. OAuth2 clients

### R21. List, filters and bulk actions

- **Decision**:
  - The list state (`oauth2/list-state.ts`, on `useListState`) holds these parameters:
    - `q`;
    - `sort`: `id`, `clientId` or `redirectUri` (default `id`);
    - `order`;
    - `tokens`: `active` or `none`, mapped to `hasActiveTokens`;
    - `page` and `size` (25, 50 or 100).
    Defaults are omitted from the address (FR-054, conventions "Lists").
  - Cards below `md`, a table from `md` up (FR-055), sharing `TokenCounts.vue` ("No active tokens",
    or both counts as text). No secret field exists in the list types.
  - **Bulk** (FR-065), through UI 002's `useBulkSelection` and `BulkResultSummary`:
    - an explicit "Select" mode; the selection covers the current page and resets through
      `useListState`'s `onReset`;
    - the maximum selection is `capabilities.bulkLimit`, which is normally at least the page size;
    - the actions are "Revoke all tokens" and "Delete", never secret regeneration;
    - the confirmation lists each selected client ID with its token counts and the consequences of
      FR-063 or FR-064, and a deletion requires typing the number of clients (`requireTyped`);
    - the request is `bulkOauth2ClientAction` with
      `targets: [{ id: String(client.id), version: client.etag }]`;
    - the summary shows one row per `BulkItemResult`, and `failed`, `refused` and `outdated` items
      stay selected;
    - a network failure reports "outcome unknown" and is never retried;
    - afterwards `['oauth2-clients', 'list']` is invalidated.
  - The **information panel** (`Oauth2InfoPanel.vue`, FR-057) is a Reka `Collapsible`, collapsed
    below `md`. It shows:
    - the endpoint addresses `new URL(capabilities.endpoints.*, location.origin)` as copyable text;
    - the scope;
    - the grant types the server accepts, with translated labels, recommending the authorization
      code grant;
    - the token lifetimes as durations.
- **Rationale**: This is the conventions' bulk pattern verbatim, and API 012 FR-060 and FR-061
  provide the operation. The capabilities make the panel accurate for each server.
- **Alternatives considered**: Hiding the password grant that legacy's text omits: rejected; the
  panel reports what the server accepts, and hiding it would mislead administrators who audit
  their applications.

### R22. Create, detail, secret dialog and redirect URIs

- **Decision**:
  - **Redirect URIs** (`oauth2/redirect-uris.ts`, `RedirectUriListField.vue`, FR-058):
    - entries can be added and removed, and at least one is required;
    - each entry must start with a scheme (`^[A-Za-z][A-Za-z0-9+.-]*:`) and be parsable by `URL`,
      which accepts custom schemes such as `com.example.app:/callback`;
    - an entry may contain no `#` and no whitespace and may be at most 2,000 characters long
      (contract `maxLength`);
    - duplicates are marked;
    - a counter shows how many characters remain of `capabilities.redirectUrisMaxLength` for the
      entries joined by single spaces.
  - **Create** is its own page (constitution II). On `201` the `clientSecret` is removed from the
    response before anything is written to the cache. Client ID and secret go only to the
    credentials dialog. When the dialog closes, `router.replace` opens the detail page.
  - **Credentials dialog** (`ClientCredentialsDialog.vue`) wraps UI 005's `OneTimeSecretDialog`. It
    adds the client ID as a second copyable value, while the uncopied-close confirmation keys on the
    secret only. Escape, Back and links while the dialog is open ask the same confirmation (FR-059).
    The secret lives in the dialog's local state, and the create and regenerate mutations use
    `gcTime: 0`.
  - **Detail** (FR-060): the identifier, the client ID with copy, the scope, the token counts, and a
    "Redirect URIs" `EditableSection` that saves through `updateOauth2Client` (merge patch with
    `redirectUris` only, `If-Match`). Stored entries that break a rule are shown and marked with the
    rule; an empty stored list reads "No redirect URI stored". Saving stays blocked until every entry
    is valid (FR-061).
  - **Actions**, each confirmed with the texts of FR-062 to FR-064 and sent with `If-Match`:
    - **Generate new secret**: `200`, then the credentials dialog; the cache is written without the
      secret.
    - **Revoke all tokens**: the `200` representation is written, so the counts show zero, and the
      outcome is announced.
    - **Delete**: `204`, the detail is removed from the cache, the list is invalidated, and
      `router.replace` opens the list with an announcement.
  - **Outdated** (`412`, FR-066): redirect URI saves follow R13. For regeneration, revocation and
    deletion, the client is refetched and the confirmation opens again with the fresh values.
  - **`404`**: the not-found state with a link back to the list (edge case "deleted by another
    administrator").
- **Rationale**: These reuse the shared secret and section patterns, and the contract's
  `Oauth2ClientWithSecret` appears only in the two responses that are handled this way.
- **Alternatives considered**: A creation dialog: rejected; the redirect URI list can be long on a
  phone, and the secret dialog would stack on a dialog.

---

## 5. Audit

### R23. Audit log extension, History links and the method filter gap

- **Decision**:
  - **Labels** (`src/features/audit-log/labels.ts`), added or refined for API 012's values:
    - event types: `identityProviderCreation`, `identityProviderUpdate`,
      `identityProviderDeletion`, `identityProviderConnectionTest`, `identityProviderSessionEnd`,
      `oauth2ClientCreation`, `oauth2ClientUpdate`, `oauth2ClientSecretRegeneration`,
      `oauth2ClientTokenRevocation` and `oauth2ClientDeletion`;
    - target types: `identityProvider` and `oauth2Client`;
    - auth methods: `singleSignOn`, `directoryPassword`, `directoryPasswordAndSecondFactor`,
      `providerPassword` and `providerPasswordAndSecondFactor`;
    - failure reasons: `signInStateInvalid`, `singleSignOnNotAvailable`, `providerRefused`,
      `providerReturnedError`, `identityProviderUnavailable`, `noEmailAddress`, `mailboxNotLinked`,
      `autoCreationOff`, `noMatchingMapping`, `mailboxCreationFailed`, `passwordNotVerifiable` and
      `connectionTestFailed`.
    The first contract bump past API 012 may already have added placeholders, because the
    translation check requires every enumeration value (001 R27). This feature gives them their
    final wording.
  - **Detail renderers** (`src/features/audit-log/components/details/`) for the whitelisted
    `details` keys of API 012's data model:
    - `changes` with old and new values, and secrets as "changed" (`{ changed: true }`);
    - for tests: `type`, `testedAddress`, `outcome`, `failureCategory` and `providerStatus`;
    - for refused removals: `mailboxCounts`;
    - for revocations and deletions: `removed` counts and `bulkRequestId`;
    - for sign-ins: `identityProvider`, `mailboxCreated`, `templateApplied` and `providerError`,
      the last shown as a technical code;
    - for mailbox creations and updates with `trigger: identityProviderSignIn`: the template, a link
      to UI 003's mailbox detail, and a link "Sign-ins of this account" to
      `/audit-log?actor=<username>&event=signIn` (API gap 2);
    - for session ends: `identityProvider` and `reason`.
    Values are text (FR-082). Unknown keys keep UI 001's generic definition list.
  - **History**: `HistoryLink` (UI 002) on the overview with `targetType=identityProvider` and no
    `targetId`, because the configuration's audit target has no identifier. On the client page with
    `targetType=oauth2Client&targetId=<numeric id>` (FR-067).
  - **No sign-in method filter**: the contract has none, and the API conventions forbid adding a
    feature-specific one. Every sign-in record shows its method label, and the existing event type,
    outcome, actor and time filters narrow the log. The generic `authMethod` filter is reported as
    API gap 1. The app never filters a page of results in the browser.
- **Rationale**: `docs/conventions.md` "History and audit" assigns labels and History to each
  feature. Filtering one page client-side would show wrong totals and miss records on other pages,
  which is exactly the workaround constitution I forbids.
- **Alternatives considered**: Client-side method filtering, as API 012's analysis suggested:
  rejected for the reason above. Searching with `q`: rejected; it does not cover the method.

---

## 6. Testing

### R24. Mock API: handlers, scenarios and a fake provider

- **Decision**:
  - **Handlers**, typed with `openapi-msw` and wrapped by the contract validator (001 R22):
    - `tests/mocks/handlers/identity-provider.ts`: capabilities, get, put, patch, delete and
      connection tests. It implements the documented rules:
      - version tags and `If-Match` with `412`;
      - `404` before the first save;
      - `201` versus `200` with `Location` and `ETag`;
      - the in-use refusal from the scenario's counts (`409` with `blockingMailboxes` and
        `mailboxCounts`);
      - `secretRequired` with the reasons `noStoredSecret`, `typeChanged` and `addressChanged`;
      - `conflictsWith`, `duplicate`, `notFound` for templates, and `immutable` for a type in a
        patch;
      - the normalisations: trailing slashes, lower-cased attribute names, StartTLS off with SSL,
        `effectivePort` 636;
      - test outcomes chosen by the scenario, including a "hang" that never answers (MSW
        `delay('infinite')`).
    - `tests/mocks/handlers/single-sign-on.ts`: start, cancel, complete and provider error. The start
      issues a random state, stores its hash, an `expiresAt` 10 minutes later and the return address
      on the scenario's session. It builds `authorizationUrl` on the fake provider host
      `https://idp.example.test/` with `redirect_uri` from the request's `Host`, which `vite preview`
      preserves. The completion consumes the state first and then answers per scenario: `201` with
      `authMethod: singleSignOn`, `401 sign-in-state-invalid`, `401 sign-in-failed`, `409`, or `503`
      with `Retry-After`.
    - `tests/mocks/handlers/oauth2-clients.ts`: capabilities, list (filters, sort, paging), create
      (12-hex client ID, 24-hex secret), get, patch, delete, regeneration, revocation, and bulk with
      per-item outcomes and versions.
    - Extensions:
      - `public-config.ts`: `singleSignOnAvailable` variants;
      - `auth.ts`: provider password accounts, `503` and the provider `authMethod` values;
      - `identity.ts`: `authentication.method: singleSignOn` with `identityProvider`, and a scenario
        switch that answers any request with `401 identity-provider-session-ended`.
  - **Fake provider**: `tests/e2e/fixtures/provider.ts` routes `https://idp.example.test/**` with
    Playwright's `page.route`. It works on every project, WebKit included, and needs no server code.
    - Mode `redirect` answers `302` to `redirect_uri` with `code=mock-code-<n>&state=<echoed state>`,
      or with `error=<code>&state=<state>`, or with only a code.
    - Mode `page` serves a minimal HTML page with "Approve" and "Cancel" links for the Back-button
      and keyboard tests.
    The provider page is not part of the app, so it gets no axe check.
  - **Request log**: the mock's recorder also stores the `Referer` header, so the tests can assert
    that no request except the completion carries the code or the state (SC-003).
  - **Scenarios**, in area modules registered in `tests/mocks/scenarios/index.ts` (001 T025):
    - `tests/mocks/scenarios/identity-provider.ts`;
    - `tests/mocks/scenarios/single-sign-on.ts`;
    - `tests/mocks/scenarios/provider-password.ts`;
    - `tests/mocks/scenarios/oauth2-clients.ts`;
    - `tests/mocks/scenarios/audit-identity-provider.ts`.
    The names are listed in [quickstart.md](./quickstart.md#part-b-manual-checks-per-user-story-mock-api).
  - **Closed enumerations** stay inside the pinned contract (001 R22). The tolerance for unknown
    audit values is tested at unit level.
- **Rationale**: The flows need state, which rules out an example-driven mock. A routed fake
  provider keeps the provider out of the app's origin and CSP, exactly as in production.
- **Alternatives considered**: A provider page served by the Node mock server: rejected; it adds
  server code and a second origin to manage, while `page.route` does the same in a few lines. A real
  Keycloak in end-to-end tests: that is the smoke suite's job (R25).

### R25. End-to-end, unit and smoke coverage

- **Decision**:
  - **End-to-end**: every acceptance scenario of US1 to US6 has at least one test, run on
    `mobile-chromium` (360 px), `desktop-chromium` and `mobile-webkit`. Spec IDs appear in the titles
    (`US2-AS4 …`, `FR-046 …`, `Edge: …`). Every screen and state calls `expectAccessible` in both
    themes and checks for horizontal scroll at 360 and 320 px (001 R24). No test needs a virtual
    authenticator except the passkey ordering on the sign-in screen, which uses `stubCredentials`.
  - **Timing checks** in the end-to-end suite, as sanity bounds on the mock:
    - from the return page's load to `home` in under 3 seconds (SC-002);
    - the OAuth2 creation flow completes on 360 px (SC-008).
    The human timings of SC-001, SC-008 and SC-012 are measured in quickstart Part D.
  - **Unit and component tests** cover:
    - every pure module (form model, patch, validation, secret rule, setup steps, connection test,
      usage, sync status, return-address check, redirect URIs, list state, capture, kept address);
    - every new component;
    - the parity check of SC-007: for each configuration of a parity fixture set, built from the
      legacy-default and legacy-stored edge values, the overview renders every non-secret value.
  - **Smoke** (against the API's dev stack, 001 R25):
    - `identity-provider.smoke.spec.ts` (`@idp`): needs `SMOKE_IDP=1`, with which
      `scripts/smoke/stack-up.sh` adds the API's `idp` profile and its OpenLDAP. It sets up LDAP
      through the app, runs a failing and a passing test, and saves.
    - `provider-password.smoke.spec.ts` (`@idp`): `carl@example.org` signs in with the directory
      password.
    - `single-sign-on.smoke.spec.ts` (`@sso`): runs only when `SMOKE_SSO_USERNAME` and
      `SMOKE_SSO_PASSWORD` are set, because the dev stack's Keycloak realm needs the manual setup of
      API quickstart Part B. It signs in through the real provider and asserts a clean address and
      clean storage.
    - `oauth2-clients.smoke.spec.ts`: create, copy, revoke and delete, plus a bulk revocation.
- **Rationale**: These are the constitution's required layers. The opt-in for the single sign-on
  smoke test is recorded under the plan's Complexity Tracking.
- **Alternatives considered**: Skipping smoke for single sign-on: rejected by constitution VI.
  Automating the Keycloak realm in this repository: rejected; the dev stack belongs to the API
  repository, where a realm import is proposed instead (plan, owner question 2).

---

## 7. Cross-cutting

### R26. Translations

- **Decision**:
  - **New namespaces** in `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`:
    - `identityProviders.*` (sub-navigation);
    - `identityProvider.*` (overview, setup, sections, fields, help texts, test, sync, usage,
      return addresses, confirmations, announcements);
    - `oauth2.*`;
    - `auth.sso.*` (action, return page, outcomes);
    - `session.notice.ssoSessionEnded` and `session.notice.signedOutSso`;
    - additions to `auditLog.*`;
    - `validation.format.{httpUrl,hostName,keycloakRealm,keycloakVersion,scopeList,ldapAttribute,ldapFilter,redirectUri,oauthErrorCode}`;
    - `validation.secretRequiredReason.{noStoredSecret,typeChanged,addressChanged}`,
      `validation.notFoundResource.mailboxTemplate` and the `duplicate` and `conflictsWith`
      wording with a position or a field label.
    `problem.*` gets entries for the six API 012 problem types if a bump has not added them yet.
  - **Parameter-driven messages**: `src/i18n/problems.ts` (001 R15) selects
    `validation.secretRequiredReason.<reason>` for `secretRequired` and
    `validation.notFoundResource.<resource>` for `notFound`, each falling back to the plain
    `validation.<code>` message. It turns `duplicateOf` (a path such as
    `attributeMapping.0.attributeValue`) into the entry's position, and `conflictsWith`'s `field`
    into that field's label. Earlier features may have added some of these selections already;
    this feature adds the missing ones.
  - **Legacy reuse** through `src/i18n/legacy-map.json` for keys whose meaning is unchanged. The full
    list is in data-model §8. It includes `admin.iam`, `admin.iam_server_url`, `admin.iam_realm`,
    `admin.iam_client_id`, `admin.iam_client_secret`, `admin.iam_version`, `admin.iam_mapping`,
    `admin.iam_default_template`, `admin.iam_default_template_description`, `admin.iam_rest_flow`,
    `admin.iam_login_provisioning`, `admin.iam_periodic_full_sync`, `admin.iam_import_users`,
    `admin.iam_sync_interval`, `admin.iam_test_connection`, the OIDC endpoint keys, the LDAP keys,
    `admin.iam_use_ssl_info`, `admin.iam_use_tls_info`, `admin.filter`, `admin.ignore_ssl_error`,
    `success.iam_test_connection`, `danger.iam_test_connection`, `danger.authsource_in_use`,
    `admin.iam_sso`, six `admin.oauth2_*` labels, `edit.scope`, `user.attribute` and
    `mailbox.template`.
  - **Not reused**: `admin.iam_description`, `admin.oauth2_info` and `admin.iam_auth_flow_info`
    contain markup; `admin.iam_extra_permission` names the product and contains markup;
    `admin.iam_host_info` described comma-separated hosts; `admin.iam_redirect_url` is now the
    classic interface's return URL; `admin.force_sso*` are not shown by this feature. Each is
    rewritten under a new key (FR-077).
  - **Slovak**: the upstream `sk-sk` file has none of the `admin.iam_*` keys, nor `admin.filter`,
    `admin.ignore_ssl_error`, `success.iam_test_connection`, `danger.iam_test_connection`,
    `danger.authsource_in_use` or `user.attribute`. Following 001 R15, their Slovak values are written
    in `src/i18n/messages/sk-sk.json` under the same app keys. That is about 45 mapped keys, plus every
    new string. The `admin.oauth2_*`, `edit.*` and `mailbox.template` keys exist in Slovak and are
    imported.
  - **Translation check** (`scripts/i18n/check.mjs`): its required enumerations gain
    `IdentityProviderType`, `IdentityProviderSynchronisation.state`,
    `IdentityProviderConnectionTestResult.outcome` and `.failureCategory`, and
    `Oauth2ClientCapabilities.grantTypes`. They are read from the generated enumeration arrays where
    `--enum-values` emits them, and otherwise from their schema paths in `contract/openapi.json`, so
    that the lists are never written by hand.
  - Provider names (Keycloak, LDAP, OpenID Connect) and technical values are never translated
    (FR-078). User-facing text says "the classic interface" (FR-079).
- **Rationale**: These are 001 R15 and R27, applied to this feature's strings and enumerations.
- **Alternatives considered**: Leaving Slovak to fall back to English: forbidden by constitution IV.

### R27. Security, storage and performance

- **Decision**:
  - **Storage**: one new key, `sessionStorage` `mailcowui-ng.sso-return-to`, which holds a validated
    in-app path and is removed on return and on the sign-in page's mount. It joins the allowlist of
    `src/shared/platform/storage.ts` and 001 data-model §4. Nothing else is stored. The storage audit
    test of UI 001 (T145) is extended: after this feature's flows, no storage, address,
    `history.state` or request (apart from the completion body) contains a code, a state, a client
    secret, a bind password or an OAuth2 client secret (SC-003).
  - **Rendering**: API values (URLs, DNs, filters, attribute values, client IDs, redirect URIs,
    tested addresses) are text interpolation only, and addresses are copyable text, not links
    (FR-082). No new `v-html`.
  - **Provider contact**: the app never requests the provider. `connect-src 'self'` would block it
    anyway; navigation to `authorizationUrl` is a top-level `location.assign`, which the CSP does not
    restrict (FR-080).
  - **Secret-bearing mutations** use `gcTime: 0` (R14, R22).
  - **Image**: a `location = /ng/sso/return` block with `access_log off` serves `index.html` with the
    security headers. The CI image check requests `/ng/sso/return?code=x&state=y` and expects
    `index.html` (R5).
  - **Performance**: all routes of this feature are lazy, in two route chunks (`provider/*` pages and
    `oauth2/*` pages), plus the return page in its own chunk. The entry gains only `capture.ts`
    (a few hundred bytes), and `budget:check` confirms the initial JavaScript stays under 200 KB
    gzipped. Lighthouse keeps measuring `/ng/sign-in` and `/ng/`. The sign-in screen gains one button
    when single sign-on is available.
- **Rationale**: These are constitution V and VII applied to the new surface.
- **Alternatives considered**: Keeping the return address only in memory: rejected; the round trip
  reloads the app, so memory does not survive it.
