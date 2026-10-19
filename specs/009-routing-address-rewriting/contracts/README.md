# Contracts of UI feature 009

This app exposes no API of its own. Its only interface is the mailcow-rest-v2 contract
(constitution I), vendored in `contract/` and pinned in `contract/VERSION.json` as UI 001
[contracts/README.md](../../001-sign-in-app-shell/contracts/README.md) describes. This file records
which contract UI 009 needs, the operations it uses and how it reacts to their problems. It does
not duplicate the contract.

## Pinned contract

| Field | Value |
|---|---|
| API repository | `FELDSAM-INC/mailcow-rest-v2` |
| API feature | 009 – routing and address rewriting (relayhosts, relayhost assignments, transports, connection tests, BCC maps, recipient maps, TLS policy maps, forwarding hosts, routing capabilities) |
| Contract version (`info.version`) | `0.1.0` (does not identify a contract, UI 001 R6) |
| Pinned commit (T002, 2026-10-19) | `e7efa732101e28f4f165f8e089ee6994d115b932` (mailcow-rest-v2 `main`, "Walk through the quickstart of feature 010 and record the gates"; planning baseline `32079252d55797d3da4e58ae661e9fb91c51c6f9`) |
| Bundle sha256 at the pin | `da783ad914587a8cb7a1db917e6c0f826675044122dfd466f0934c3ecbfc09aa` (`@redocly/cli@2.64.1 bundle`) |
| Operations in the bundle | 379, including the 46 of API 009 |
| API 009 modules last changed | `dd505ae` ("Plan feature 009 and author its contract") |

The contract bump task (T002 in [tasks.md](../tasks.md)) pins the commit that the API 009
implementation was released against, or its release tag, with `scripts/contract/bump.sh`. Pins
are monotonic: if UI 002–008 already pinned a commit at or after one whose 46 routing operations
are identical to the baseline's, that pin is kept (research R1). The task records the final commit
and sha256 here, replacing the baseline rows.

**Changes since the baseline** (T002 review of `git diff 3207925 e7efa73 -- api/modules/{relayhosts,relayhost-assignments,transports,bcc-maps,recipient-maps,tls-policy-maps,forwarding-hosts,routing-capabilities} api/components`):
the routing gaps are closed (G34 `requiredFlagsMatch` through `PermissionFlagRequiredProblem`; G35
the normalised `nextHop` filter; G36 `maxLengths.forwardingHost`, `testSender`, `testRecipient`;
G37 `immutable` in `RelayhostPatch`) and G41 adds `username` to `RelayhostChoice` for every caller
who may read the choices. The patches of transports, recipient maps, TLS policy maps and
forwarding hosts name their read-only members. No operation was removed or renamed. Under the
forms rule (plan, legacy form map part 3, decision 9) `getForwardingHost` and
`updateForwardingHost` are not called: legacy has no forwarding host edit page.

## Operations used by this feature

"A" means administrators, "DA" domain administrators. Every write sends `X-CSRF-Token` (UI 001 R8)
and, where the contract offers it, `If-Match` with the `etag` that was read.

| operationId | Method and path | Who | Used by | Requirements |
|---|---|---|---|---|
| `getRoutingCapabilities` | GET `/capabilities/routing` | A, DA | limits, bulk limit, test defaults and timeouts, TLS policies | FR-016, FR-044, FR-045, FR-058 (research R3) |
| `listRelayhosts` | GET `/relayhosts` | A | relayhost list; administrator's relayhost picker (username shown) | FR-019, FR-020, FR-032 |
| `createRelayhost` | POST `/relayhosts` | A | add form | FR-021, FR-028 |
| `listRelayhostChoices` | GET `/relayhost-choices` | A, DA with a relayhost flag | domain administrator's relayhost picker | FR-032, FR-036 |
| `applyRelayhostBulkAction` | POST `/relayhosts/bulk-actions` | A | selection: activate, deactivate, delete | FR-015–FR-017 |
| `getRelayhost` | GET `/relayhosts/{relayhostId}` | A | edit page, test page | FR-022 |
| `updateRelayhost` | PATCH `/relayhosts/{relayhostId}` | A | edit form, activate and deactivate | FR-022, FR-024, FR-026, FR-027 |
| `deleteRelayhost` | DELETE `/relayhosts/{relayhostId}` | A | delete with impact | FR-017, FR-018, FR-024 |
| `listRelayhostUsage` | GET `/relayhosts/{relayhostId}/usage` | A | usage view; deletion impact (two reads with `limit=10`) | FR-018, FR-023 |
| `testRelayhostConnection` | POST `/relayhosts/{relayhostId}/connection-test` | A | test page | FR-043–FR-049 |
| `getDomainRelayhostAssignment` | GET `/domains/{domain}/relayhost-assignment` | A, DA (own domains) | domain Relayhost section | FR-029, FR-031, FR-034 |
| `replaceDomainRelayhostAssignment` | PUT `/domains/{domain}/relayhost-assignment` | A, DA with `domainRelayhost` | domain Relayhost section save | FR-029, FR-033 |
| `getMailboxRelayhostAssignment` | GET `/mailboxes/{mailbox}/relayhost-assignment` | A, DA (own mailboxes) | mailbox Relayhost section | FR-030, FR-031, FR-034, FR-035 |
| `replaceMailboxRelayhostAssignment` | PUT `/mailboxes/{mailbox}/relayhost-assignment` | A, DA with `mailboxRelayhost` | mailbox Relayhost section save | FR-030, FR-033 |
| `listTransports` | GET `/transports` | A | transport list; shared next hop lookup (`nextHop`) | FR-037, FR-038, FR-041 |
| `createTransport` | POST `/transports` | A | add form, one request per destination | FR-039–FR-041 |
| `applyTransportBulkAction` | POST `/transports/bulk-actions` | A | selection | FR-015–FR-017 |
| `getTransport` | GET `/transports/{transportId}` | A | edit page, test page | FR-042 |
| `updateTransport` | PATCH `/transports/{transportId}` | A | edit form, activate and deactivate | FR-041, FR-042 |
| `deleteTransport` | DELETE `/transports/{transportId}` | A | delete | FR-017, FR-042 |
| `testTransportConnection` | POST `/transports/{transportId}/connection-test` | A | test page | FR-043–FR-049 |
| `listBccMaps` | GET `/bcc-maps` | A, DA (scope, no flag) | BCC list | FR-050, FR-051 |
| `createBccMap` | POST `/bcc-maps` | A, DA with `bccMaps` | add form | FR-052, FR-054 |
| `listBccDestinationChoices` | GET `/bcc-destination-choices` | A, DA (scope) | local destination picker | FR-052 |
| `applyBccMapBulkAction` | POST `/bcc-maps/bulk-actions` | A, DA with `bccMaps` | selection, including type switches | FR-015–FR-017 |
| `getBccMap` | GET `/bcc-maps/{bccMapId}` | A, DA (scope) | entry page (read-only without the flag) | FR-050, FR-053 |
| `updateBccMap` | PATCH `/bcc-maps/{bccMapId}` | A, DA with `bccMaps` | edit form, activate and deactivate | FR-053 |
| `deleteBccMap` | DELETE `/bcc-maps/{bccMapId}` | A, DA with `bccMaps` | delete | FR-017 |
| `listRecipientMaps` | GET `/recipient-maps` | A | recipient map list | FR-055 |
| `createRecipientMap` | POST `/recipient-maps` | A | add form | FR-056 |
| `applyRecipientMapBulkAction` | POST `/recipient-maps/bulk-actions` | A | selection | FR-015–FR-017 |
| `getRecipientMap` | GET `/recipient-maps/{recipientMapId}` | A | entry page | FR-055 |
| `updateRecipientMap` | PATCH `/recipient-maps/{recipientMapId}` | A | edit form, activate and deactivate | FR-056 |
| `deleteRecipientMap` | DELETE `/recipient-maps/{recipientMapId}` | A | delete | FR-017, FR-056 |
| `listTlsPolicyMaps` | GET `/tls-policy-maps` | A | TLS policy map list | FR-057 |
| `createTlsPolicyMap` | POST `/tls-policy-maps` | A | add form | FR-058 |
| `applyTlsPolicyMapBulkAction` | POST `/tls-policy-maps/bulk-actions` | A | selection | FR-015–FR-017 |
| `getTlsPolicyMap` | GET `/tls-policy-maps/{tlsPolicyMapId}` | A | entry page | FR-057 |
| `updateTlsPolicyMap` | PATCH `/tls-policy-maps/{tlsPolicyMapId}` | A | edit form, activate and deactivate | FR-058 |
| `deleteTlsPolicyMap` | DELETE `/tls-policy-maps/{tlsPolicyMapId}` | A | delete | FR-017, FR-058 |
| `listForwardingHosts` | GET `/forwarding-hosts` | A | forwarding host list (`source` filter) | FR-059 |
| `createForwardingHost` | POST `/forwarding-hosts` | A | add form (`201` or `200`) | FR-060–FR-062 |
| `applyForwardingHostBulkAction` | POST `/forwarding-hosts/bulk-actions` | A | selection: spam filter on or off, delete | FR-015–FR-017 |
| `getForwardingHost` | GET `/forwarding-hosts/{forwardingHostAddress}` | A | entry page | FR-063 |
| `updateForwardingHost` | PATCH `/forwarding-hosts/{forwardingHostAddress}` | A | spam filter switch | FR-063 |
| `deleteForwardingHost` | DELETE `/forwarding-hosts/{forwardingHostAddress}` | A | delete | FR-017, FR-063 |

All 46 operations of API 009 are used. Two operations of earlier features are relied on without new
calls:

| operationId | Use |
|---|---|
| `getIdentity` (API 001) | role, scope domains and the flags `bccMaps`, `domainRelayhost`, `mailboxRelayhost` (already loaded by UI 001) |
| `listAuditEvents` (API 001, target filters from API 002) | target of the History links `/audit-log?targetType=…&targetId=…`; called by UI 001's audit log screen, not by this feature |

Mailbox users get `403 forbidden` on every operation above. The UI never calls them for that role,
because the catalogue entry and the Relayhost sections are not shown to it.

## Problem types and the app's response

Messages come from `problem.<name>` or the routing mapping, never from `title` or `detail`.

| `type` | Status | Operations | App behaviour |
|---|---|---|---|
| `/api/v2/problems/validation-failed` | 422 | every write and list | Field messages from `errors` (codes below); summary with focus (FR-013, FR-065) |
| `/api/v2/problems/routing-entry-exists` | 409 | create and update of transports, BCC maps, recipient maps, TLS policy maps; bulk BCC type switch (`refused`) | Message at `field`, using the entry type's legacy `danger.*_exists` text, with a link to `conflictingId` |
| `/api/v2/problems/next-hop-credentials-differ` | 409 | `createTransport` (documented for creation only) | `danger.invalid_nexthop_authenticated` at the username field naming `nextHop`, links to `transportIds` (US3-AS5) |
| `/api/v2/problems/next-hop-interferes` | 409 | `createTransport`, `updateTransport` | Explanation at the next hop field naming `nextHop`, links to `transportIds` (US3-AS6) |
| `/api/v2/problems/permission-flag-required` | 403 | relayhost choices, assignment replacements, BCC writes and bulk | "Missing permission: {flags}" from `requiredFlags`, labelled with UI 007's legacy `acl.*` flag labels; neutral wording because `requiredFlagsMatch` is not declared (gap G34); refresh identity; nothing shown as done (FR-003) |
| `/api/v2/problems/forbidden` | 403 | every operation | UI 001's "no permission" handling and identity refresh |
| `/api/v2/problems/insufficient-key-scope`, `csrf-token-mismatch`, `pending-action-required` | 403 | every write | UI 001's handling (CSRF retry, restricted session); a key scope problem cannot occur in a browser session |
| `/api/v2/problems/temporary-failure` | 503 | transports, BCC maps, recipient maps (lock), forwarding hosts (Redis, DNS) | Message with a retry enabled after `Retry-After`; in bulk results, the item's reason |
| `about:blank` | 404 | entry reads and writes, assignments | "This entry no longer exists" with the way back to the list |
| `about:blank` | 412 | every write with `If-Match` | Input kept, entry reloaded, changed values marked (research R6) |
| `/api/v2/problems/unauthenticated` | 401 | every operation | UI 001: session ended |
| other types and statuses | — | — | UI 001's generic message with the request ID (FR-067) |

The UI spec's "too many requests" and "attribute not permitted" are not documented for any API 009
operation; they keep UI 001's shared translations and are not mocked here (research R19).

### Validation rule codes and parameters of this feature

| Code | Params | Typical field | Message |
|---|---|---|---|
| `required` | — or `because: password` | any; `username` | `validation.required`; `validation.requiredBecause.password` ("A username is needed for a password") |
| `tooLong` | `max` | any string | `validation.tooLong` |
| `tooMany` | `max` | `bccDestination` (`max: 1`), `targets` (bulk limit) | `add.bcc_dest_format` for the BCC destination; `validation.tooMany` otherwise |
| `notInList` | `allowed` | `policy` | `validation.notInList` |
| `invalidFormat` | `format`: `nextHop`, `transportDestination`, `recipientMapDestination`, `tlsPolicyDestination`, `tlsPolicyParameters`, `domainName`, `email`, `ipNetwork` | host, next hop, destinations, parameters, test addresses, forwarding host | `validation.format.<format>` |
| `invalidRegex` | — | MX-based transport `destination` | `validation.invalidRegex` |
| `immutable` | — | read-only members | `validation.immutable` (cannot occur with changed-fields-only saves; translated anyway). `RelayhostPatch` names the code `readOnly` instead (gap G37); it falls back to `validation.invalid` until aligned |
| `notFound` | — | `localDestination`, `relayhostId` | `validation.notFound` with routing wording ("not found in your domains" / "relayhost no longer exists") |
| `notResolvable` | — | forwarding host `host` | `validation.notResolvable` |
| `invalidCharacter` | `characters` | `username` | `validation.invalidCharacter` ("must not contain {characters}") |

### Bulk item outcomes

`done`, `notFound`, `refused`, `outdated` and `failed` (`BulkItemOutcome`), shown by UI 002's
`BulkResultSummary` with the item's `problem` translated as above. Forwarding host bulk actions
report Redis outages as `failed` with `temporary-failure`.
