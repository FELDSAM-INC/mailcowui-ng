# Analysis: UI feature 012 Identity providers and OAuth2

The plan agent ran `/speckit-analyze`. The orchestrator recorded the results here, because the
harness would not let the subagent write this file.

## Result

All 82 FRs, 13 SCs and 44 acceptance scenarios map to tasks. Every story has end-to-end tests at
360 px and desktop with axe, plus smoke tests. 0 CRITICAL and 0 HIGH findings remain open.

**HIGH, fixed:**
- the pin policy is aligned with UI 002;
- shared building blocks use the canonical names;
- broken links: the mailbox list parameter is `source`, and the `operations` catalogue row was
  replaced by UI 011's rows;
- translation checks use UI 002's coverage manifest;
- bulk-limit and secret handling follow the conventions;
- test ordering is fixed;
- FR and SC traces were added.

## Remaining (below HIGH)

- **MEDIUM:** the SSO smoke test is opt-in until the API dev stack has a Keycloak realm (API gap
  G21).
- **MEDIUM:** audit detail keys follow API 012's data model until `docs/audit-events.md` has a 012
  section (G3).
- **MEDIUM:** building-block names come from plans. T002 re-checks them.
- **MEDIUM:** `RESTV2_SSO_RETURN_PATH` must stay `/ng/sso/return`.
- **LOW:**
  - the connection test alone has a 90 s client timeout (the spec requires it);
  - reordering LDAP hosts counts as an address change;
  - SC-001, SC-008 and SC-012 are measured by hand.

## API gaps

Tracked in mailcow-rest-v2 `docs/api-gaps.md`:
- G18: an `authMethod` filter on the audit log;
- G19: a `requestId` filter on the audit log;
- G20: `If-None-Match: *` on `PUT /identity-provider`;
- G21: a Keycloak realm in the dev stack.

## Orchestrator decisions

1. The owner arranges a native review of the new cs-cz and sk-sk strings, about 45 `admin.iam_*`
   keys new in Slovak.
2. The SSO smoke test is opt-in now and becomes a gate once G21 is done.
3. Cross-feature: UI 005's `useSecretMutation`, and UI 001's API key creation, must not pass
   secrets through TanStack mutation caches (secrets rule). Alignment has been requested.
