# Analysis: UI feature 009 Routing and address rewriting

The plan agent ran `/speckit-analyze` with an independent reviewer and a script-based traceability
pass. The orchestrator recorded the results here, because the harness would not let the subagent
write this file.

## Result

1 CRITICAL, 2 HIGH, 11 MEDIUM and 18 LOW findings. Coverage is 75/75 FR, 10/10 SC, 48/48 acceptance
scenarios and 27/27 edge cases.

- **C1:** the gaps were not specified in mailcow-rest-v2 first. They are now registered as G34 to
  G37 in mailcow-rest-v2 `docs/api-gaps.md`, so the T001 gate can pass.
- **H1:** the upstream Slovak `mailbox.bcc_info` markup would have failed the import. The rich-hint
  rules now handle it, with fixtures.
- **H2:** FR-035's note was hidden in the worst case. It now has a "no credentials sent" variant.
- All MEDIUM findings are fixed.

## Remaining (LOW)

- The spec says "eight TLS policies", though the server may restrict the list.
- Changing a domain's relayhost is deliberately not confirmed (R5).

## Notes

- UI 001's catalogue row for "BCC maps" should follow UI 009's consistency change 7: every domain
  admin sees Routing, read-only without the flag. This is aligned when UI 001's spec next changes.
- The owner reviews about 400 new cs-cz and sk-sk strings before release (T118 lists them).
