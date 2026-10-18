# Research: Administrators and Domain Administrators

**Feature**: `specs/007-administrators-domain-admins` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

Every open point of the plan is settled here, in this order of precedence: the constitution, then
the pinned mailcow-rest-v2 contract, then `docs/conventions.md`, then UI 001's decisions, then best
practice. Each entry has a **Decision**, its **Rationale** and the **Alternatives considered**.
UI 001's research (R1–R29) applies unchanged unless an entry here says otherwise; "UI 001 R8" refers
to it.

---

## 1. Foundations

### R1. Contract pin, dependencies and the bump

- **Decision**:
  - **Pin**: mailcow-rest-v2 commit **`32079252d55797d3da4e58ae661e9fb91c51c6f9`**. Its bundle
    (`@redocly/cli@2.64.1 bundle api/openapi.yaml`) has sha256
    `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6`, 250 paths and 376
    operations, and lists `KnownProblemType` (86 types) under `components.schemas`.
    - API 007's contract last changed in `a13c370` ("Apply orchestrator decisions to feature 007");
      no later commit touches its modules or components.
    - The contracts of API 004 (`df21611`) and API 005 (`f8d973a`) were merged after `a13c370`, so
      the pin must be at least as new as those. `3207925` is the contract head on 2026-10-18 and
      also registers `KnownProblemType` (UI 001 plan, gap 5).
  - **Bump rule**: when UI 001–006 left `contract/VERSION.json` at a commit that already contains
    `a13c370`'s API 007 files and the API 004 and 005 contracts, UI 007 keeps that pin. Otherwise
    T001 runs `scripts/contract/bump.sh 32079252d55797d3da4e58ae661e9fb91c51c6f9` (never "the latest
    commit", UI 001 R6).
  - **Consequences of the bump** (handled in T001–T004):
    - the generated `schema.ts` gains the root types and the enumeration arrays this feature uses
      (`domainAdminPermissionNameValues`, `accountSecondFactorStatusValues`,
      `knownProblemTypeValues`);
    - `i18n:check` requires a label for every value of the enumerations it covers, including
      `AuditEventType`, `AuditTarget.type` and `AuthMethod` values of API features after 007 that
      the pin contains. Labels for 007's values are written by this feature; values of later
      features get their real labels from their own UI features, and until then the generic
      fallback of UI 001 FR-074 is supplied as their message so that the check passes;
    - `scripts/i18n/check.mjs` adds `DomainAdminPermissionName` and `AccountSecondFactorStatus` to
      its list of covered enumerations (UI 001 R27 rule 3).
  - **Dependencies**: none added. Every runtime and development package of UI 001 R1 and R2 is
    enough.
- **Rationale**: The pin must contain the contracts of every feature implemented before or with
  UI 007. A commit SHA is authoritative because `info.version` stays `0.1.0` (UI 001 R6). Taking
  `3207925` also closes UI 001's problem-type gap.
- **Alternatives considered**: Pinning `a13c370` was rejected: it lacks the final contracts of API
  004 and 005, which UI 004 and UI 005 need. A separate pin per feature is impossible: the app has
  one generated client.

### R2. Module layout and boundaries

- **Decision**:
  - **`src/features/administrators/`**: both account lists, both creation forms and both detail
    screens, with the components they share (status badges, actions menu, bulk bar, username
    field, sign-in requirements, account section, domain picker, permission editor, one-time link
    section). Single-use components stay here (constitution VIII).
  - **`src/features/acting/`**: the entry actions `SignInAsAction.vue` and `OpenWebmailAsAction.vue`,
    `ActingUnavailableNotice.vue`, the pure eligibility rules (`eligibility.ts`), the webmail opener
    (`webmail-opener.ts`), `useActingState()` and the mutations `startImpersonation`,
    `endImpersonation` and `createWebmailSignInOnBehalf` (`api.ts`). Other features import them only
    from `@/features/acting` (UI 001 R3). Its users are `features/mailboxes` (UI 003),
    `features/administrators`, `features/passkeys`, `features/account` and the shell.
  - **Core (`src/app/`)**: the identity-switch protocol (`session/identity-switch.ts`,
    `session/identity-key.ts`, `session/acting-origin.ts`) and the shell parts every screen needs
    (`shell/ActingBanner.vue`, `shell/ShellNotice.vue`). The query cache's error hooks, the
    cross-tab channel, the sign-in landing and acting all call the switch, so it cannot live in a
    feature.
  - **`src/features/auth/`** (UI 001) gains the landing page, `sso-token-capture.ts` and
    `useSsoTokenSignIn()`.
  - **Entry chunk**: only `ActingBanner.vue`, `ShellNotice.vue` and the session modules join it
    (about 3 KB gzipped). Every page of `administrators`, the landing and the acting actions are in
    lazy chunks. `budget:check` verifies it (T105).
- **Rationale**: One directory per catalogue section keeps the shared account components without
  cross-feature imports. Acting is used by five features, so its entry actions need a public
  surface; its core must sit where the shell and the query client can reach it.
- **Alternatives considered**: Separate `features/admins` and `features/domain-admins`: rejected,
  because about 15 components would be shared and need promoting to `src/shared/` with only these
  two users. Putting the entry actions in `src/shared/`: impossible, because shared code may not
  import `src/app/` (UI 001 R3), and the actions need the switch.

### R3. Routes and navigation

- **Decision**:
  - The catalogue keeps its single entry `administrators` (path `/administrators`, administrators
    only), and T041 sets its `status` to `available`. The section has two lists, linked by a tab bar
    (`AdministratorsSectionTabs.vue`, a `<nav>` with two links and `aria-current="page"`) shown on
    both list pages.
  - Routes (all lazy, `meta.navEntry: 'administrators'`):

    | Name | Path | Page |
    |---|---|---|
    | `administrators` | `/administrators` | redirect to `domain-admins`, keeping the query |
    | `domain-admins` | `/administrators/domain-admins` | `DomainAdminsPage.vue` |
    | `domain-admin-create` | `/administrators/add-domain-admin` | `DomainAdminCreatePage.vue` |
    | `domain-admin-detail` | `/administrators/domain-admins/:username([A-Za-z0-9._-]{1,255})` | `DomainAdminDetailPage.vue` |
    | `admins` | `/administrators/admins` | `AdminsPage.vue` |
    | `admin-create` | `/administrators/add-admin` | `AdminCreatePage.vue` |
    | `admin-detail` | `/administrators/admins/:username([A-Za-z0-9._-]{1,255})` | `AdminDetailPage.vue` |
    | `sign-in-sso-token` | `/sign-in/sso-token` | `features/auth/pages/SsoTokenLandingPage.vue` (auth layout, any session state) |

  - The creation forms are siblings of the lists, not children of the detail path, because every
    word is a valid username: `/administrators/admins/new` would hide an administrator named `new`.
  - The detail routes are the targets of UI 014's `/edit/domainadmin/{username}` and
    `/edit/admin/{username}` (M22, M23), and the landing is the target of
    `/domainadmin?sso_token=…` (M13).
  - Every list keeps its state in the address (FR-003, FR-007); a detail page's back link returns to
    the list address it was opened from (`history.state.back` when it is a list route of this
    section, otherwise the plain list).
- **Rationale**: The UI 001 spec lists one catalogue section, and UI 014 maps `/admin/system` to it.
  The domain administrator list opens first because it is the daily task (US1 is P1, US4 P2).
- **Alternatives considered**: Two catalogue rows (`domainAdmins`, `administrators`): rejected,
  because it changes UI 001's catalogue table, which the spec fixes (owner question 2 in the plan).
  A section landing page with two cards: rejected as an extra tap for a daily task.

---

## 2. Identity switching

### R4. The identity-switch protocol

- **Decision**: `src/app/session/identity-switch.ts` exports
  `switchIdentity({ reason, csrfToken?, identity?, target })`. Every identity change runs it:

  | Reason | Trigger | `target` after the switch | Notice |
  |---|---|---|---|
  | `actingStarted` | `startImpersonation` `201` | `home` | announce `success.logged_in_as` |
  | `actingEnded` | `endImpersonation` `204` | the acting origin, else `home` | announce "Returned to your account" |
  | `actingEndedByServer` | any `403 impersonation-ended` | the acting origin, else `home` | shell notice: acting ended, last action not carried out (FR-051) |
  | `changedInAnotherTab` | `session-changed` on the channel; an identity refresh whose key differs; a `csrf-token-mismatch` whose re-read identity differs | the current route if the new identity may use it, else `home` | shell notice: account changed in another tab; with a refused write also "your last action was not carried out" (FR-053) |
  | `sessionReplaced` | the landing's `createSessionWithSsoToken` `201` while a session existed | as after sign-in (UI 001 R11) | — |
  | `selfRenamed` | `updateAdmin` of the own username `200` | `admin-detail` with the new name | announce the saved result |

  The steps, in this order, so that nothing of the previous identity is shown (FR-052, SC-004):
  1. `identityTransition = true` in the session store. `ShellLayout` and `AuthLayout` render a
     "Switching account…" status (`role="status"`) instead of `<RouterView>`, so the current page
     unmounts and its forms, drafts and observers are destroyed.
  2. `await nextTick()`, then `queryClient.cancelQueries()`, `queryClient.getMutationCache().clear()`
     and `queryClient.clear()`.
  3. The anti-forgery token: `setCsrfToken(csrfToken)` when the response carried one (start),
     otherwise `refreshCsrfToken()` (`GET /csrf-token`, single-flight).
  4. The identity: `setQueryData(['identity'], identity)` when the response carried it (start),
     otherwise `GET /me`. Then `GET /session` (the guard and the banner read `Session.state` and
     `impersonation`). A `401` here ends the session as UI 001 R11 describes.
  5. Broadcast `{ v: 1, type: 'session-changed' }`, except when the reason is
     `changedInAnotherTab` (the change came from elsewhere).
  6. Resolve the target: the origin or the current route is kept only when
     `canAccess(route.meta.navEntry, identity)` holds; otherwise `home` (spec edge case "screen not
     available after a switch"). `router.push(target)`.
  7. `identityTransition = false`; announce or show the notice; UI 001's focus rule moves focus to
     the new page's `<h1>`.

  The **identity key** is `${username}|${role}|${impersonation?.id ?? ''}`
  (`src/app/session/identity-key.ts`). UI 001 R12's mismatch check (username and role) uses it, so
  that ending and restarting acting as the same target is still a change.

  A **failure** of steps 3 or 4 by network leaves the transition screen with a retry, and never
  shows the previous identity's page again.
- **Rationale**: TanStack's `clear()` removes queries but leaves mounted observers holding their
  last data, so a page could keep showing the previous identity's list until it unmounts.
  Unmounting first, then clearing, guarantees FR-052. One protocol for seven triggers keeps the
  rules in one tested module.
- **Alternatives considered**: A full page reload after every switch (as legacy redirects): rejected,
  because it loses the in-memory acting origin, the announcement and the anti-forgery token, and
  costs a bootstrap. Clearing only the queries of the previous role: rejected, because shared paths
  (`/`, `/account`, `/quarantine`) show different data per identity.

### R5. Anti-forgery retry after an identity change

- **Decision**: UI 001 R8's CSRF middleware (`src/api/csrf.ts`) changes as the pinned contract's
  "Authentication" section requires:
  1. On `403 csrf-token-mismatch` and no retry yet: `refreshCsrfToken()`, then `GET /me` directly
     through the client (not the query cache).
  2. Compare its identity key (R4) with the cached identity's key.
     - **Equal**: replay the cloned request once with the new token (UI 001 behaviour).
     - **Different**: do not replay. Run `switchIdentity({ reason: 'changedInAnotherTab',
       identity, refusedWrite: true })` and reject the original request with an `ApiProblem` whose
       `kind` is `'identityChanged'`. Screens ignore this kind: the switch unmounts them.
     - `401` from `GET /me`: the session ended (UI 001 R11).
  3. A second mismatch after a replay still ends the session (UI 001 FR-035).

  The new `kind` is added to `ApiProblem` in `src/api/problem.ts`, typed as an app-defined union
  member, not an API shape.
- **Rationale**: The token is renewed on every switch precisely so that a write prepared under one
  identity is refused instead of running as another (API 007 R16). Replaying it blindly, as UI 001
  does, would defeat that. The contract and API conventions ("Bulk paths and identity changes") make
  the re-read mandatory for clients.
- **Alternatives considered**: Asking the user whether to resend: rejected by the spec ("It never
  resends the request automatically") and because the form that prepared it belongs to the previous
  identity. Never replaying at all: rejected, because a token can also be lost by a session renewal
  that keeps the identity, and UI 001 FR-035 requires the silent retry then.

### R6. Acting origin

- **Decision**: When "Sign in as" starts acting, `acting-origin.ts` stores the current route's
  `fullPath` (path, search, filters, page and size, all in the address by convention) in the
  session store field `actingOrigin`, in memory only. Ending acting, explicitly or by
  `impersonation-ended`, routes there when the restored identity may use the route, and to `home`
  otherwise (FR-046, SC-005). The origin is cleared on every switch that is not a start. A reload, or
  a return from another tab, has no origin and opens `home`.
- **Rationale**: The list state is already in the address, so the full path restores search,
  filters and page exactly. Memory only keeps paths that can contain search terms, such as a mailbox
  address, out of device storage (constitution V, UI 001 data-model §4).
- **Alternatives considered**: `sessionStorage`: rejected for the reason above. `history.state` of
  the origin entry: rejected, because the user navigates while acting and the entry is no longer
  reachable in a defined way.

### R7. Acting banner

- **Decision**: `src/app/shell/ActingBanner.vue`, rendered by `ShellLayout` and `AuthLayout` when
  `identity.impersonation` is present (the pending-actions screen can appear while acting when the
  impersonator becomes restricted; ending acting stays allowed there, API 007 R16).
  - **Placement**: the first element of the sticky top region, above the header, in normal flow, so
    it pushes the content down (FR-044). A `ResizeObserver` writes the sticky region's height to
    the CSS custom property `--shell-sticky-height` with `style.setProperty` (CSSOM, allowed by the
    CSP), and `scroll-padding-top` uses it, so a focused element is never hidden (WCAG 2.4.11).
  - **Markup**: `<section aria-labelledby="acting-banner-title">` (a named region, FR-045) with:
    - an icon (`user-switch`, `aria-hidden`) and the title "Acting as {target}, {role}";
    - the line "Signed in as {impersonator} since {time}" (`DateTime`, time only when today, date
      and time otherwise);
    - the button "Return to {impersonator}", at least 44 × 44 px (FR-044, FR-046).
  - **Colours**: new tokens `--color-acting-bg`, `--color-acting-fg` and `--color-acting-border` in
    `src/styles/main.css`, an amber treatment distinct from the header in both themes and checked
    by axe in both. The icon and the words "Acting as" carry the state, never the colour alone.
  - **Long names** (spec edge case): a mailbox address renders as a flex row of the local part
    (`truncate`, `min-w-0`) and `@domain` (never shrinks), which gives an ellipsis in the middle with
    the domain kept. Other usernames truncate at the end. The title is a button that toggles a
    wrapped, full-text view (`aria-expanded`); its accessible name always holds the full text.
  - **Title prefix** (FR-045): `src/app/router/title.ts` prefixes `acting.titlePrefix`
    ("Acting as {username} · ") while acting.
  - **Announcements** (FR-045, FR-070): R4 announces starts and ends through `useAnnouncer`
    (polite). The banner itself has no live region, so it is not re-announced on every navigation.
- **Rationale**: Sticky and in flow satisfies "visible while scrolling" and "pushes the content
  down" at every width without covering content. The icon, text and region meet WCAG 1.4.1 and
  2.4.6; the title prefix makes the state visible in the tab list.
- **Alternatives considered**: A fixed overlay: rejected, because it covers content and needs
  padding hacks. Hiding the details behind a menu on phones: forbidden by FR-044. A coloured header
  only: fails WCAG 1.4.1.

### R8. Who may act, and the entry points into earlier screens

- **Decision**:
  - **Eligibility** (`src/features/acting/eligibility.ts`, pure functions over the identity):
    - `canSignInAs(identity, target)`: false while `identity.impersonation` is present or the
      identity has pending actions; administrators: true for every mailbox user and domain
      administrator, active or not; domain administrators: true only for mailbox users whose domain
      is in `scope.domains` and only when `permissions.loginAs`; mailbox users: false; never for
      administrator accounts or resources (FR-040, FR-042).
    - `canOpenWebmailAs(identity, mailbox, groupwareEnabled)`: as `canSignInAs` for a mailbox user,
      plus `identity.webmailOnBehalfEnabled === true` and `groupwareEnabled` from UI 003's mailbox
      capabilities (`MailboxCapabilities.groupwareEnabled`), so that the action is hidden on a
      server without webmail instead of failing with `groupware-disabled` (FR-055).
  - **Entry points** (FR-041, conventions "Where features meet"):
    - the domain administrator list's `AccountActionsMenu` and the detail page header
      (`features/administrators`);
    - the mailbox list entry action menu and the mailbox detail action area of UI 003
      (`features/mailboxes`), each rendering `SignInAsAction` and `OpenWebmailAsAction` with the
      mailbox entry.
    Both render nothing when the rule is false: no placeholder, no disabled item.
  - **Starting** (FR-043): `SignInAsAction` calls `startImpersonation({ role, username })`. Before
    the request it records the origin (R6). On `201` it runs R4 with the response's identity and
    token. Refusals (`already-impersonating`, `forbidden`, `permission-flag-required`, `404`) show
    their translated message in place and leave the user in their own view (FR-042).
  - **Credential controls while acting** (FR-049): `useActingState().isActing` disables, with the
    visible reason "Not available while acting as another user" (`ActingUnavailableNotice.vue`):
    - UI 001's passkey page: add, rename and remove;
    - UI 005's own password change, second-factor enrolment and removal, recovery e-mail change and
      the mailbox home's Webmail action (FR-057).
    A `not-allowed-while-impersonating` refusal shows the same text (`problem.not-allowed-while-impersonating`).
  - **Sign out completely** (FR-047): UI 001's `UserMenu.vue` labels the sign-out
    "Sign out completely" while acting; the action is UI 001's sign-out, which ends the whole session
    (API 007 FR-051).
  - **Navigation** follows the identity, which describes the target with its effective flags
    (FR-048); nothing else is needed.
- **Rationale**: Eligibility mirrors API 007 FR-042 to FR-044 and FR-054, so the UI never offers what
  the API refuses; refusals are still handled (constitution V). Rendering nothing for ineligible
  entries follows the conventions' "no placeholder" rule.
- **Alternatives considered**: Asking the API (`startImpersonation` dry run): not offered and not
  needed. Showing a disabled "Sign in as" with a reason for domain administrators without the flag:
  rejected; the spec says no mailbox offers it (US2-AS4).

### R9. Webmail on a user's behalf

- **Decision** (`src/features/acting/webmail-opener.ts`):
  1. On "Open webmail as", call `createWebmailSignInOnBehalf(mailbox)`. The response sets the
     webmail hand-off cookie in this browser and returns `url` (`/SOGo/so/`).
  2. Then `const win = window.open(url, '_blank')`, and when it returns a window, set
     `win.opener = null`. The app stays on its screen (FR-056).
  3. When `window.open` returns `null` (blocked, typical for iOS Safari after an asynchronous
     request), show an inline notice with a link "Open webmail" (`target="_blank"`,
     `rel="noopener noreferrer"`) that the user taps.
  4. Refusals are messages and open nothing, so no empty tab can remain:
     `webmail-on-behalf-disabled`, `not-allowed-while-impersonating`, `groupware-disabled`,
     `permission-flag-required`, `422 notEligible` on `mailbox` with `reason` (`mailboxInactive`,
     `loginDisabled`, `domainInactive`), `404`.
  - **While acting** the API refuses every webmail sign-in (API 007 FR-049, FR-054), so
    `OpenWebmailAsAction` is never offered while acting, and UI 005's Webmail action on the
    impersonated user's home is disabled with the acting reason (FR-057 as aligned).
- **Rationale**: Requesting first and opening afterwards means a refusal never leaves an empty tab.
  `noopener` in the features string would make `window.open` return `null` even on success, so the
  opener is cleared afterwards instead, which still lets the app detect a blocked window.
- **Alternatives considered**: Opening a blank window synchronously before the request and
  navigating it afterwards: rejected; on phones it switches tabs before the app can show an error,
  and closing it afterwards is unreliable. Navigating the app's own tab: forbidden by FR-056.

---

## 3. One-time sign-in

### R10. The one-time sign-in landing

- **Decision**:
  - **Address** (FR-058): `/ng/sign-in/sso-token?sso_token=<token>`, documented for operators in
    `quickstart.md`. The parameter keeps legacy's name, so UI 014 maps `/domainadmin?sso_token=…`
    one to one (M13), and billing panels change only the path.
  - **Capture before anything else** (FR-059): `src/main.ts` calls `captureSsoToken()` from
    `@/features/auth` before the bootstrap. When `location.pathname` is the landing path, it reads
    `sso_token`, keeps it in a module-level variable (memory only), and calls
    `history.replaceState(history.state, '', <path without the token>)`. The bootstrap requests and
    the first render therefore never see the token, and history holds no entry with it.
  - **No exchange on prefetch** (FR-059): the page exchanges only when
    `document.visibilityState === 'visible'` and `document.prerendering !== true`; otherwise it
    waits for `visibilitychange` or `prerenderingchange`. Plain HTTP prefetches never run scripts.
  - **Flow** (`useSsoTokenSignIn()`, state machine in data-model §7):
    - no token captured: redirect to `sign-in`;
    - `Session.state` `anonymous`: exchange at once;
    - `active`, `restricted` or `pendingSecondFactor`: ask first (FR-060). The question names the
      current account (`Session.username`) and "the domain administrator this link was created
      for" (plan gap G1). "Continue" exchanges; "Stay signed in as {username}" discards the token
      and opens `home` (or the current state's screen).
  - **Exchange**: `createSessionWithSsoToken({ token })`, then the token variable is cleared,
    whatever the outcome.
    - `201`: write `session`; for a previous session run R4 with `sessionReplaced`, otherwise UI
      001's after-sign-in path. `restricted` goes to the pending-actions screen (FR-060, US5-AS4);
      `active` goes to `home`. Broadcast `session-changed`.
    - `401 sign-in-failed`: `sign-in` with the notice `ssoLinkInvalid` ("This sign-in link is
      invalid or has expired", FR-061), without a reason.
    - `429 too-many-requests`: the landing shows UI 001's throttling message with its countdown
      (`useThrottle`) and a link to normal sign-in (FR-061).
    - `422` (an empty or over-long token): handled as `sign-in-failed`.
    - a network failure: a message with "Try again" while the token is still in memory.
  - **Guard**: the route carries `meta.anySessionState: true`; UI 001's guard lets it through in
    every state.
- **Rationale**: Capturing in `main.ts` is the earliest point the app controls; `replaceState` keeps
  the token out of the address bar, history and later `Referer` headers. The visibility and
  prerender checks stop browsers' speculative loading from consuming a single-use token.
- **Alternatives considered**: A fragment (`#sso_token=`) to keep the token out of server logs:
  rejected; legacy, billing panels and UI 014 use the query parameter, the token lives 30 seconds
  and is single-use, and supporting two forms adds tests for no protection the single use does not
  give. Always asking before an exchange: rejected by US5-AS1 ("without typing a password", directly
  to the home screen). Exchanging in the router guard: rejected; a guard cannot show the question.

### R11. Creating a one-time link

- **Decision**:
  - `SsoLinkSection.vue` on the domain administrator detail screen offers "Create sign-in link",
    disabled with the reason "The account is inactive" when `active` is false (FR-062).
  - The token is requested with a direct client call (`issueDomainAdminSsoToken`), not through
    `useMutation`, so it is never held by the mutation cache; the response (`Cache-Control: no-store`)
    goes only into the dialog's local state.
  - The link is shown in UI 005's `OneTimeSecretDialog.vue` (conventions "Secrets": one-time
    sign-in links use the one-time secret dialog), which this feature extends with two optional
    props:
    - `expiresAt` and `serverDate`: a countdown through `useCountdown` with the clock skew from the
      response's `Date` header (UI 001 R13), announced at the start and at 10 seconds;
    - at zero: the text "This link has expired", the copy control disabled, and the footer action
      "Create new link" (FR-063). Closing an expired link needs no confirmation; closing an unexpired
      one without copying asks, as for every secret.
  - Content: the full link built by `sso-link.ts` from `location.origin`, the router base and the
    token; the copy control (result announced, FR-062); the warning "Opening this link in this
    browser replaces your current session". There is no "open" control.
  - Leaving the screen or closing the dialog clears the link (FR-063).
  - `409 account-inactive` shows its message and refreshes the account.
- **Rationale**: The conventions name one-time sign-in links as secrets that use the shared dialog;
  the countdown is the only addition. A direct call keeps the credential out of every cache.
- **Alternatives considered**: An inline section display: rejected by the conventions. `useMutation`
  with `gcTime: 0`: workable, but the result still sits in the mutation cache until the component
  resets it; a direct call is simpler.

---

## 4. Account screens

### R12. Lists, filters and the active-administrator count

- **Decision**:
  - **Domain administrators** (`DomainAdminsPage.vue`, `useListState` schema in `list-state.ts`):
    `q` (username and domain names), `status` (`active`/`inactive` → `active`), `tfa`
    (`AccountSecondFactorStatus` → `secondFactorStatus`), `pending` (`passwordChange` →
    `forcePasswordChange=true`, `secondFactorSetup` → `forceSecondFactorSetup=true`), `domain`
    (repeatable, ≤ 100 → `domain`), `permission` (`DomainAdminPermissionName`) with `permissionValue`
    (`on`/`off`, default `on`), `sort` (`username`, `active`, `createdAt`, `modifiedAt`,
    `domainCount`), `order`, `page`, `size` (25/50/100).
  - **Administrators** (`AdminsPage.vue`): `q`, `status`, `tfa`, `pending`, `sort` (`username`,
    `active`, `createdAt`, `modifiedAt`), `order`, `page`, `size` (FR-032).
  - **Cards** below `md` (`DomainAdminCard`, `AdminCard`), the whole card a link to the detail with
    the actions menu as a separate control; **tables** from `md` (`DomainAdminTable`, `AdminTable`)
    with sortable headers (`aria-sort`) (FR-006).
  - **Card content**: username, the first three assigned domains (`domainUnicode`) and "+N more",
    a "No domains" warning for an empty list, a "not a domain" marker for `domainExists: false`,
    `SecondFactorStatusBadge` (none, active, "suspended until next sign-in"), `AccountStatusBadge`,
    and for administrators the "You" marker when `username === identity.username` (FR-005, FR-032,
    FR-069: text, never colour alone).
  - **Empty states**: without filters, the explanation of domain administrators (or
    administrators) and the primary action; with filters, "No matches" and "Clear filters" (FR-004,
    US1-AS9).
  - **Active-administrator count**: `listAdmins({ active: true, limit: 1 })` → `meta.total`, query
    key `['admins', 'active-count']`, fetched on the administrator list and detail screens and
    invalidated after every administrator status change, deletion and bulk action. It drives
    FR-036.
- **Rationale**: The parameters are the contract's filters one to one (API 007 FR-011, FR-012), and
  the address keeps them (conventions "Lists"). A one-entry list read gives the count without a
  dedicated operation.
- **Alternatives considered**: Counting active administrators from the current page: wrong with
  filters or more than one page. Hiding the "You" marker: legacy computes it but never shows it,
  which the spec improves.

### R13. Bulk actions

- **Decision**:
  - **Selection**: UI 002's `useBulkSelection` (selection mode on phones, checkboxes on wide
    screens, current page only, cleared through `useListState`'s `onReset`).
  - **Request**: `applyDomainAdminBulkAction` or `applyAdminBulkAction` with
    `{ action, targets: [{ id: username, version: etag }] }`, at most
    `AccountCapabilities.bulkLimit` targets (100); page sizes never exceed it. One request for the
    selection (FR-010 as aligned). The bar shows a busy state while it runs.
  - **Client checks before sending** (`bulk.ts`, pure):
    - the own administrator account is removed from the targets of `delete` and `deactivate`, and
      the summary states "Your own account was left out" (FR-035, clarification);
    - `deactivate` on administrators is stopped before any request when the selected active
      accounts are at least the active-administrator count, with "At least one administrator must
      stay active" (FR-036);
    - `suspendSecondFactors` sends only accounts whose status is `active`.
  - **Confirmations**: `delete` asks once, listing the selected usernames (and, for domain
    administrators, the consequences of FR-025) and requiring the number of accounts typed (UI 002
    `requireTyped`; conventions "Confirmations"). `suspendSecondFactors` asks once (FR-024's text).
    `activate` and `deactivate` of other accounts do not ask (FR-026).
  - **Summary**: UI 002's `BulkResultSummary` with one row per account: `done`, `notFound`,
    `refused` (the problem translated: `last-active-admin`, `cannot-delete-own-account`),
    `outdated`, `failed`. Accounts with `refused`, `outdated` and `failed` stay selected; `done`
    accounts are updated by invalidating the list, the details and the active count. A dropped
    connection is reported as "outcome unknown" and never retried.
- **Rationale**: API 007 FR-075 and the conventions replaced the spec's "one request per account";
  the shared blocks of UI 002 implement the conventions once. The client checks keep the spec's
  promises before the API's per-item refusals.
- **Alternatives considered**: One request per account (the spec's first wording): rejected by the
  contract and the conventions, and it would write one audit record per request without a
  `bulkRequestId`.

### R14. Creation forms, usernames, passwords and the domain picker

- **Decision**:
  - **Forms** (full pages, FR-011, FR-033): sections Account (username, password, active on by
    default), Domains (domain administrators only), Sign-in requirements (two switches, off by
    default) and, for domain administrators, Permissions (a Reka `Collapsible`, collapsed). The
    account capabilities (`getAccountCapabilities`, key `['capabilities', 'accounts']`) give the
    defaults (`newAccountDefaults`, `domainAdminPermissionDefaults`), `usernameMaxLength` and
    `bulkLimit`. One `createDomainAdmin`/`createAdmin` request; only flags that differ from the
    defaults are sent in `permissions` (FR-015). When the capabilities cannot be read, the
    Permissions section shows the error with a retry and the form can still be saved without
    permissions, with the note that the server defaults apply.
  - **Username** (`username.ts`, `UsernameField.vue`, FR-012): on blur, trim and lower-case. Before
    submission: required; at most `usernameMaxLength`; only `a-z`, `0-9`, `.`, `_`, `-`; at least
    one letter or digit; not `api`. These are the rules the contract documents on
    `AdminCreateRequest`. The hint lists the allowed characters. Server errors are mapped too:
    `invalidFormat` (`format: accountUsername`), `reserved`, `tooLong` and `409 account-exists`
    (FR-016).
  - **Password** (FR-014): UI 003's password field (show/hide, "Generate" that meets the policy and
    reveals and offers to copy, the policy rules listed from `getPasswordPolicy`). The value is in
    the form's local state only, cleared on unmount, never in the query cache or the router. In the
    detail screen's Account section the field starts empty and an empty value keeps the password
    (FR-020). Each unmet rule from the server is shown on the field.
  - **Domain picker** (`DomainPicker.vue`, `DomainPickerDialog.vue`, FR-013):
    - the form shows the selection as removable chips (`domainUnicode`, with the ASCII name as a
      title when different) and an "Add domains" button;
    - the dialog (a Reka `Dialog`, full screen below `md`, a centred panel above) has a search field
      and a checkbox list over `listDomains({ q, sort: name, limit: 25 })` with "Load more"
      (`useInfiniteQuery`, key `['domains', 'picker', { q }]`, 300 ms debounce), so thousands of
      domains stay usable;
    - "Done" applies the selection; Escape and "Cancel" discard it;
    - at least one domain is required before submission;
    - the request sends ASCII names (`Domain.name`);
    - server errors on `domains.<index>` (`notFound`, `notEligible` with `kind: aliasDomain`,
      `invalidFormat` with `format: domainName`) mark the matching chip and name the entry (spec
      edge case "domain removed while the form is open").
  - **After creation** (FR-017): the success message names the account (`success.domain_admin_added`,
    `success.admin_added`) and the detail page opens with `router.replace`.
- **Rationale**: Every value comes from the contract or its capabilities read (conventions: no
  hard-coded limits). One picker for every width keeps one implementation while meeting the phone
  rule.
- **Alternatives considered**: A Reka `Combobox` with multiple selection on desktop: rejected; a
  second implementation of the same picker. Sending every flag at creation: works, but the spec
  asks to send only the differing ones, and it would freeze the defaults of the client.

### R15. Detail screens, sections, renames, status changes and removal

- **Decision**:
  - **Sections** (FR-018, FR-034) through UI 002's `EditableSection` (own edit and save, only the
    changed fields, `If-Match` with the etag of the latest cached account, changed-value marking
    after `412`):
    - Account: username, status, creation and modification dates (`DateTime`); edit: username,
      status, new password;
    - Domains (domain administrators): `DomainAssignmentList` (each existing domain links to UI
      002's domain detail; "not a domain" warning; an assignment status that differs from the
      account's shows its own badge, FR-022); edit through the picker, which leaves out entries
      with `domainExists: false` and refuses an empty selection;
    - Sign-in and security: second-factor status, number of active passkeys, the two forced flags
      (FR-023, the product name in `edit.force_pw_update_info` from branding), and "Suspend
      two-factor authentication until next sign-in" when the status is `active` (FR-024);
    - Permissions (domain administrators, R16);
    - One-time sign-in link (domain administrators, R11);
    - "View history" (`HistoryLink`, R18).
  - On phones a section index (`DetailSectionIndex.vue`, in-page links) heads the page; on wide
    screens the sections stack in one column with the same index as a side list.
  - Each save updates `['…', 'detail', username]` with `setQueryData` from the response, so the
    other sections use the new etag; a `412` means another client changed the account.
  - Leaving with unsaved changes in any section asks for confirmation (`onBeforeRouteLeave`,
    FR-019).
  - **Rename** (FR-021): another account → a confirmation that its open sessions and any acting
    session on it end; the own administrator account → a confirmation that names the new username
    for the next sign-in. After success the page replaces its address with the new username; the
    own rename runs R4 with `selfRenamed`.
  - **Status** (FR-026, FR-036, FR-037): activating or deactivating another account needs no
    confirmation, and the message states the effect (deactivation: sessions end and API keys stop
    working until reactivation). Deactivating the last active administrator is disabled with "At
    least one administrator must stay active". Deactivating the own account asks first, warning that
    the session ends; after the `200`, the app calls `GET /session`; when it reports `anonymous`, UI
    001's session end runs with the new notice `selfDeactivated` (FR-037).
  - **Removal** (FR-025, FR-035, FR-038): a confirmation whose content `confirmations.ts` builds:
    the account, its domains (domain administrators), the permanent revocation of its API keys, the
    removal of its passkeys and second factors, the end of its sessions, and for domain
    administrators that the domains and mailboxes stay. The confirm button names the action ("Remove
    domain administrator", "Remove administrator"). The own account's "Remove" is disabled
    everywhere with "You cannot remove the account you are signed in with". After `204` the list
    opens and the result is announced. `412` asks again (conventions).
  - **API refusals** always show and then reload the account (FR-039): `last-active-admin`,
    `cannot-delete-own-account`, `account-exists`, `412`, `404` (the not-found state with a link to
    the list, spec edge case "removed with its last domain").
- **Rationale**: UI 002's section pattern implements the conventions; the confirmations carry the
  spec's texts; the self-deactivation flow turns the API's "ends at its next request" into an
  immediate, explained sign-in screen.
- **Alternatives considered**: One form for the whole account: rejected by FR-019 and the
  conventions. Signing out locally after self-deactivation without asking the API: rejected; the
  session end should be confirmed by the server state.

### R16. Permission flag editor

- **Decision**:
  - `permissions.ts` holds the group map of FR-028, typed `Partial<Record<DomainAdminPermissionName,
    PermissionGroup>>`:
    - Mailbox settings: `protocolAccess`, `smtpIpAccess`, `unlimitedQuota`, `mailboxRelayhost`,
      `sogoAccess`, `appPasswds`, `pushover`, `syncjobs`, `filters`;
    - Domain settings: `domainDesc`, `domainRelayhost`, `aliasDomains`, `aliasExternalGoto`,
      `extendSenderAcl`, `bccMaps`;
    - Spam and quarantine: `spamPolicy`, `quarantine`, `ratelimit`;
    - Access: `loginAs`.
    The groups are built by iterating `domainAdminPermissionNameValues`; a value without a group
    lands in "Other" (FR-028). A unit test asserts that the 19 values of the pin are all grouped and
    that an unknown plain value goes to "Other".
  - `PermissionsEditor.vue`: one `<fieldset>` with a `<legend>` per group; per flag a Reka `Switch`
    with its label (legacy `acl.<column>` through `legacy-map.json`) and a one-line explanation
    (new key `permissions.explanation.<flag>`) referenced by `aria-describedby` (FR-027, FR-030).
    Used by the creation form (bound to the defaults) and by `PermissionsSection.vue`.
  - `PermissionsSection.vue` sends `updateDomainAdmin({ permissions: <changed flags> })` with
    `If-Match` (FR-029), shows `success.acl_saved`, keeps the switches on failure and on `412` (with
    "load current values"), and joins the unsaved-changes guard.
  - An account without a permission record reads every flag as off, exactly as the API reports it;
    saving creates the record (spec edge case).
  - No permission editor exists for administrators (FR-031).
- **Rationale**: Iterating the generated enumeration keeps the editor complete after a contract bump;
  the typed partial map makes a missing group visible in review without breaking the build.
- **Alternatives considered**: A `Record` over every flag: a later flag would fail type checking
  instead of showing in "Other", which the spec asks for. A native multi-select, as legacy: rejected
  (parity table: unusable on phones and with screen readers).

---

## 5. Cross-cutting

### R17. Errors and translations

- **Decision**:
  - **Problem messages** (FR-064, FR-065), keyed by `problem.<name>` (UI 001 R15):
    `account-exists`, `last-active-admin` (legacy `warning.no_active_admin`),
    `cannot-delete-own-account` (legacy `warning.cannot_delete_self`), `already-impersonating`,
    `impersonation-ended`, `not-allowed-while-impersonating` ("Not available while acting as another
    user"), `webmail-on-behalf-disabled`, `account-inactive`, and the reused `permission-flag-required`
    (with the translated flag from `requiredFlags`), `groupware-disabled`, `session-required` and
    the `412` "changed elsewhere".
  - **Field messages**: `validation.format.accountUsername`; `reserved` on a username (legacy
    `danger.username_invalid` with the name); `notEligible` with `kind: aliasDomain` on a domain;
    `notEligible` with `reason` on a mailbox (three messages); `immutable` and `unknownField` fall
    back to the generic `validation.<code>`; feature 003's password codes (`tooShort`,
    `missingCharacterClass`) come from UI 003. `account-exists` maps to the username field (legacy
    `danger.object_exists`).
  - **Legacy keys** (FR-030, FR-072, SC-007): the 42 keys of the spec's list and the 19 flag labels
    `acl.<column>` are mapped in `src/i18n/legacy-map.json`. Upstream `cs-cz` and `sk-sk` lack
    `tfa.force_tfa`, `tfa.force_tfa_info` and `acl.alias_external_goto`; their app layers supply them
    (UI 001 R15). `edit.force_pw_update_info` keeps its `%s` (→ `{0}`) for the product name.
    `admin.generate` ("generate", lower case) is not mapped; the password field's own label comes
    from UI 003.
  - **New namespaces**: `accounts.*` (shared account texts), `domainAdmins.*`, `admins.*`,
    `permissions.*`, `acting.*`, `webmailOnBehalf.*`, `ssoSignIn.*` (landing), `ssoLink.*` (link
    creation), additions to `auditLog.*` and `auth.signIn.notice.*`.
  - **Enumerations** checked by `i18n:check`: `DomainAdminPermissionName` and
    `AccountSecondFactorStatus` are added; the 007 values of `AuditEventType` (12),
    `AuditTarget.type` (`admin`, `domainAdmin`, `ssoToken`, `impersonation`) and `AuthMethod`
    (`ssoToken`) get labels (R1 for values of later features).
- **Rationale**: Messages by type and code, never by English detail (constitution I). Reusing the
  legacy keys carries their translations over (constitution IV).
- **Alternatives considered**: Reusing `warning.no_active_admin` for the disabled reason too:
  rejected; the spec gives a different, clearer text for the reason ("At least one administrator
  must stay active"), while the legacy text fits the refusal.

### R18. Audit log and History links

- **Decision**:
  - **History** (FR-071, US7-AS1): each detail page renders UI 002's `HistoryLink` with
    `targetType=admin` or `domainAdmin` and `targetId=<username>`.
  - **Impersonated account** (US7-AS2, AS3) in UI 001's audit log feature:
    - list state gains `impersonated` (string ≤ 255) → `impersonatedAccount`, with a filter field
      and a removable chip;
    - `AuditEventItem.vue` shows, when `impersonatedAccount` is present, the actor (the
      impersonator) and the marker "while acting as {username} ({role})" in text;
    - `labels.ts` gains the 12 event types of API 007, the four target types and the `ssoToken`
      method.
  - The account detail's History link and the impersonation filter compose: an administrator can
    open an account's history and add the impersonated filter.
- **Rationale**: API 007 FR-069 adds exactly these filters and fields, so the feature that introduces
  them presents them (spec clarification).
- **Alternatives considered**: A separate "impersonation log" screen: rejected; the audit log already
  filters and pages.

### R19. Query keys and cache policy

- **Decision**: New roots in `src/api/query/keys.ts` (full table in data-model §3):
  `['admins', 'list', params]`, `['admins', 'detail', username]`, `['admins', 'active-count']`,
  `['domain-admins', 'list', params]`, `['domain-admins', 'detail', username]`,
  `['capabilities', 'accounts']`, `['domains', 'picker', { q }]`. They follow UI 001 R9's defaults
  (30 s stale time; capabilities 5 min). Mutations write the returned account with `setQueryData`
  and invalidate the lists (and the active count for administrators). Tokens, links and webmail
  sign-ins are never cached. The identity switch clears everything (R4).
  - `src/api/query/client.ts` adds `impersonation-ended` to the session-level reactions of UI 001
    R8 step 4, delegating to `switchIdentity({ reason: 'actingEndedByServer' })`; the request is never
    retried.
- **Rationale**: UI 001's key factory and invalidation pattern; only the switch empties the cache.
- **Alternatives considered**: Keeping capabilities across switches: rejected; they are
  administrator-only and an identity switch can remove access.

---

## 6. Testing

### R20. Mock API for accounts, impersonation and tokens

- **Decision**:
  - **Handlers** (with `openapi-msw`, wrapped by UI 001's validator):
    - `tests/mocks/handlers/admins.ts`: `listAdmins` (filters, sorts, paging, `meta.total`),
      `createAdmin`, `getAdmin`, `updateAdmin` (merge patch, `If-Match`/`412`, rename,
      `last-active-admin` atomically over the scenario state, self-deactivation ending the session
      at the next request), `deleteAdmin` (`cannot-delete-own-account`, `last-active-admin`),
      `suspendAdminSecondFactors`, `applyAdminBulkAction` (in order, per-item outcomes,
      `tooMany` above the limit), `getAccountCapabilities`;
    - `tests/mocks/handlers/domain-admins.ts`: the same for domain administrators, with domain
      normalisation and the `domains.<i>` errors, `permissions` merge, the `domain` and
      `permission`/`permissionValue` filters, `domainCount` sort;
    - `tests/mocks/handlers/sso-tokens.ts`: `issueDomainAdminSsoToken` (`Cache-Control: no-store`,
      30 s expiry, `409 account-inactive`) and `createSessionWithSsoToken` (single use, expiry,
      replacing any session, `restricted` for forced accounts, `401 sign-in-failed`, `429` after the
      scenario threshold);
    - `tests/mocks/handlers/impersonation.ts`: `startImpersonation`, `endImpersonation`,
      `getImpersonation` and `createWebmailSignInOnBehalf` with every refusal of API 007 R16 and
      R21, in the API's order of checks;
    - changes: `identity.ts` (target identity, effective flags of API 007 R18, `impersonation`,
      `webmailOnBehalfEnabled`), `auth.ts` (the anti-forgery token renewed on every start, end and
      automatic end, so an old token gets `csrf-token-mismatch`; `deleteSession` ends the whole
      session while acting), `passkeys.ts` and UI 005's `self-service.ts` (`not-allowed-while-impersonating`
      on credential and webmail hand-off operations while acting), `audit.ts` (`impersonatedAccount`
      in records and as a filter).
  - **Automatic end**: `PATCH /__mock/scenarios/:id` with `{ invalidateImpersonation: '<reason>' }`
    makes the next session request, except `endImpersonation` and `deleteSession`, answer `403
    impersonation-ended`, end the impersonation and renew the token, as API 007 R17 describes.
  - **Scenario modules**: `tests/mocks/scenarios/administrators.ts` (lists of 3, 0 and 120 domain
    administrators; no domains; a non-domain assignment; differing assignment status; no permission
    record; one and two active administrators; changed elsewhere), `acting.ts` (admin with mailboxes
    and domain administrators; domain administrators with and without `loginAs`; webmail setting on
    and off; groupware disabled; already acting), `sso-sign-in.ts` (valid, expired, used and
    malformed tokens; a forced password change; throttled).
  - **Factories**: `tests/mocks/factories/{admin,domain-admin,impersonation}.ts`.
  - **Webmail tab**: the end-to-end fixture `tests/e2e/fixtures/popup.ts` fulfils `/SOGo/**` with a
    stub page and records popups; `window.open` blocking is simulated with an init script.
  - **Tabs**: `tests/e2e/fixtures/tabs.ts` opens a second page in the same browser context (shared
    cookie and BroadcastChannel) and offers `startImpersonationOutOfBand()`, which calls the mock
    through `context.request` with the session cookie, so the API renews the token without a
    broadcast, as a tab whose message was missed (US2-AS10).
- **Rationale**: The API's renewal and automatic-end behaviour must be modelled for FR-051 to FR-054
  to be testable; validated handlers keep the mock within the contract (UI 001 R22).
- **Alternatives considered**: Faking the switch in the browser only: rejected; the anti-forgery and
  cross-tab behaviour would not be exercised.

### R21. Tests: unit, end-to-end, smoke

- **Decision**:
  - **Unit and component** (Vitest): eligibility; identity key; the switch protocol (order of
    steps, unmount before clear, targets, notices, failures); the CSRF identity check; acting origin;
    the banner (region, names, middle ellipsis, button, colours by token, title prefix); the landing
    capture (token out of the address before the bootstrap) and its state machine; the webmail
    opener (blocked window, refusals); username rules; permission groups; bulk planning (own
    account, last administrator); list-state mappings; the domain picker; the one-time link dialog
    countdown; confirmations' content.
  - **End-to-end** (Playwright, both viewports plus `mobile-webkit`, axe in both themes on every
    screen and dialog, UI 001 fixtures): every acceptance scenario of US1 to US7, the edge cases
    the mock can produce, and SC-001, SC-002, SC-003, SC-004, SC-005, SC-008 and SC-010. Test titles
    carry the spec IDs (`US2-AS3 …`, `FR-052 …`, `Edge: …`). SC-004 is asserted by checking, after
    every switch, that no text of the previous identity's list or detail is visible and that
    `mockApi.requests()` holds no resent request.
  - **Smoke** (against the API dev stack and its `DevelopmentSeeder`: `admin`, `reseller`,
    `alice@example.org`, password `Passw0rd!dev`):
    - create, change, suspend and remove a domain administrator `smoke-da-<random>` with one domain;
    - change one permission flag and see it after reload;
    - as `admin`, act as `alice@example.org` from the mailbox list and return; act as `reseller` from
      the domain administrator list and return;
    - issue a one-time link for `reseller`, open it in a new browser context and land on its home;
    - the audit log filtered by impersonated account `alice@example.org` shows the run's records;
    - webmail on behalf only when `SMOKE_WEBMAIL_ON_BEHALF=1` says the stack enables
      `ALLOW_ADMIN_EMAIL_LOGIN`.
    Nothing destructive touches `admin` or `reseller`.
- **Rationale**: Constitution VI's three layers; the smoke cases cover what the mock cannot prove:
  real token renewal, real single use and the real audit records.
- **Alternatives considered**: Testing acting only at unit level: rejected; the banner on every
  screen and the cross-tab behaviour are browser properties.

### R22. Building blocks expected from UI 002–006

- **Decision**: UI 007 uses these blocks where the earlier feature put them; the tasks name the
  expected paths:

  | Block | Expected path | Owner | If it is still feature-local |
  |---|---|---|---|
  | `useBulkSelection`, `BulkResultSummary` | `src/shared/composables/`, `src/shared/components/` | UI 002 (UI 001 R20) | — (UI 003 already reuses them) |
  | `ConfirmDialog` with `requireTyped` | `src/shared/components/ConfirmDialog.vue` | UI 002 | — |
  | `EditableSection` and the field diff of `useVersionedSave` | `src/shared/components/EditableSection.vue` | UI 002 | — |
  | `HistoryLink`, audit `targetType`/`targetId` | `src/shared/components/HistoryLink.vue`, `src/features/audit-log/list-state.ts` | UI 002 | — |
  | Domain detail route name | `domain-detail` from `@/features/domains` | UI 002 | use the name UI 002 exports |
  | Mailbox entry action menu and detail action area | `src/features/mailboxes/components/MailboxActionsMenu.vue`, `src/features/mailboxes/pages/MailboxDetailPage.vue` | UI 003 | use the components UI 003's tasks name |
  | Password field with generator and policy | `src/shared/components/PasswordField.vue` | UI 003, promoted at its second use (UI 005) | T037 promotes it without behaviour change |
  | Password policy and mailbox capabilities queries | exported by `@/features/mailboxes` | UI 003 | — |
  | Section tab bar | `src/shared/components/SectionTabs.vue` | UI 004 | `AdministratorsSectionTabs.vue` stays in the feature |
  | Detail section index | `src/shared/components/SectionIndex.vue` | UI 002 | `DetailSectionIndex.vue` stays in the feature |
  | `OneTimeSecretDialog` | `src/shared/components/OneTimeSecretDialog.vue` | UI 005 (UI 001 R20) | — |
  | Own credential screens and the Webmail action | `src/features/account/` | UI 005 | use the components UI 005's tasks name |

- **Rationale**: UI 001 R20 fixed the owners of the first rows; the others follow constitution
  VIII's "promote at the second use". Naming the fallback keeps the tasks executable whatever the
  earlier plans decided.
- **Alternatives considered**: Re-implementing missing blocks inside this feature: rejected as
  duplication when the earlier feature already has them.
