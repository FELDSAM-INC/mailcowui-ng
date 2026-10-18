# Analysis: UI feature 013 System settings

The plan agent ran `/speckit-analyze`. The orchestrator recorded the results here, because the
harness would not let the subagent write this file.

## Result

109 FRs, 14 SCs and 84 acceptance scenarios are all cited by tasks (100 %). No CRITICAL findings.

**HIGH, fixed:**
- **H1:** the 5 s job refresh conflicted with UI 001 FR-033. It is resolved by the conventions'
  polling rule.
- **H2:** the spec promised a translated failure reason that the contract can't provide. It is now
  recorded as API gap G16.
- **H3:** FR-008 (search sends no request) is tested (T041).
- **H4:** FR-011 (an outdated deletion asks again) is tested (T053, T107).

## Remaining (below HIGH)

- **MEDIUM:**
  - the mass-mail preview keeps its search out of the address (FR-108, Complexity Tracking);
  - the paths of earlier features' files are expected paths;
  - Firefox has a manual check for the e-mail preview;
  - the limit-palette axe passes roughly double the suite time;
  - T076 may need contrast fixes in earlier screens;
  - audit labels may need completing.
- **LOW:**
  - the live regex check also flags an inner `/`, as the API does;
  - the Sieve parser message is quoted in English;
  - one vague invalidation row in the data model.

## API gaps

Tracked in mailcow-rest-v2 `docs/api-gaps.md`:
- G16: a `failureCode` for mass-mail recipients;
- G17: summary list responses for regex maps and mass-mail jobs.

## Orchestrator decisions on owner questions

1. The CSP is amended to `img-src 'self' blob:` for logo previews before upload.
2. FR-055's link to the Rspamd documentation stays. It is documentation, not a request the app
   makes.
3. The owner reviews the new cs-cz and sk-sk strings before release.
