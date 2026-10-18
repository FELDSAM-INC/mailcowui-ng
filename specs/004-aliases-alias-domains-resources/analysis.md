# Analysis: UI feature 004 Aliases, alias domains, resources and sender ACL

The plan agent ran `/speckit-analyze`. The orchestrator recorded the results here, because the
harness would not let the subagent write this file.

## Result

All 71 FRs, 11 SCs and 65 acceptance scenarios are covered, with no constitution conflicts.

Fixed:
- an alias create test relied on an undocumented `503`;
- the alias-domain and resource lists lacked the FR-015 row actions;
- deactivating a single object, and turning on "any address", had no confirmation;
- research and the data model disagreed on a cache key;
- names are aligned with the canonical list;
- picker states, FR references, a locale-formatting test, and smoke tests that assumed seed data.

## Remaining (below HIGH)

- **MEDIUM:** the "Send as" labels depend on API gap G12, which API 004's implementation fixes
  before UI 004 is implemented.
- **MEDIUM:** FR-005 and FR-071 versus a page-size edge case. Resolved in research, and T113 aligns
  the spec.
- **MEDIUM:** promotions edit UI 002 and 003 code. T007 updates references if a name changes.
- **MEDIUM:** destinations and external sender addresses are shown in ASCII until API gap G13 is
  fixed.
- **LOW:**
  - not every reused legacy key exists in all three locales (8 are missing upstream);
  - some task labels;
  - the search debounce differs from UI 002 (500 ms versus 300 ms);
  - smoke tests depend on the API seeder.

## API gaps

Tracked in mailcow-rest-v2 `docs/api-gaps.md`: G3 (audit details), G12, G13 and G14.

## Orchestrator decisions on owner questions

1. "Send as" ships with full labels, because G12 is fixed in API 004 first.
2. The owner reviews the roughly 185 new cs-cz and sk-sk strings and the 8 missing legacy values
   before release.
3. "Select all" selects the first N items up to the bulk limit and states the limit, uniformly for
   every list (`docs/conventions.md`).
