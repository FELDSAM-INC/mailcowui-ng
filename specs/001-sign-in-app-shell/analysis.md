# Specification analysis: UI feature 001

**Feature**: `specs/001-sign-in-app-shell` | **Date**: 2026-10-18 | **Command**: `/speckit-analyze`

The plan agent ran the analysis. The orchestrator recorded the results here, because the harness
would not let the subagent write this file.

**Artifacts analysed**:
- `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/README.md` and
  `tasks.md`;
- the constitution (1.2.0) and `docs/conventions.md`;
- the mailcow-rest-v2 contract at the pinned commit `293b7c2`.

**Method**: two passes, both run before any fix.
1. An independent read-only review by a separate agent.
2. A mechanical and factual pass: FR, SC and acceptance-scenario tracing by script; generating the
   client from the pinned bundle; checking Reka UI's build for `<style>` injection; checking
   mailcow's nginx headers and the upstream Slovak legacy file.

Every CRITICAL and HIGH finding is resolved in commit `4a89695`.

## Findings: CRITICAL and HIGH (all resolved)

| ID | Severity | Summary | Resolution |
|---|---|---|---|
| C1 | CRITICAL | Mock audit records with unknown enum values would violate the pinned contract's closed enums. | Unknown values are no longer seeded. Later event types are covered by unit tests with plain values (T137), and T023 asserts that the validator rejects them. |
| C2 | CRITICAL | The QueryClient defaults, the branding and app-link logic, and the home greeting had no failing test first. | `query-client.spec.ts` (T030), branding and app-link specs (T040), and a greeting assertion (T068) were added. |
| C3 | CRITICAL | Default colours (IV) and an eager sign-in route (VII) were marked PASS without a recorded deviation. | The sign-in route is lazy now. The default colours are recorded in Complexity Tracking. |
| H1 | HIGH | "Pin the latest commit touching `api/`" would pin every later feature's paths. | The pin is exactly `293b7c293ec0…` (feature 001), or its release tag. |
| H2 | HIGH | The Phase 2 end-to-end test needed routes that only arrive in US1. | T048 uses the generated placeholders and the catch-all only. |
| H3 | HIGH | Catalogue entries marked `available` had no routes yet, and a link was added twice. | Every entry starts as `placeholder` and its story flips it. T092 asserts that no entry leads to "not found". |
| H4 | HIGH | Stories claimed independence they did not have. | The announcement banner moved to the foundation, scenarios moved to the right stories, and the dependency table states the real dependencies. |
| H5 | HIGH | A mock 503 on the bootstrap operations violated the contract, and nginx's HTML 502 was unhandled. | Modelled as a transport failure or a documented 500. `ApiProblem` has `kind: 'unavailable'`. |
| H6 | HIGH | "Check again" refetched only `identity`. | It now refetches `session` and `identity`. |
| H7 | HIGH | Upstream `sk-sk` lacks legacy keys, and legacy values carry decorative glyphs. | Per-locale fallback layers; decorative glyphs are stripped. |
| A1 | HIGH | `--enum-values` cannot emit into a `.d.ts` file. | The output is `src/api/generated/schema.ts`. |
| A2 | HIGH | `KnownProblemType` was dropped from the bundle. | The UI derives the types from the response descriptions. **API side fixed by the orchestrator:** `KnownProblemType` is now listed under `components.schemas`. |

MEDIUM (18) and LOW (17) findings were resolved as well. They are listed in full in the agent's
report and summarised here:
- conventions and security: keep-input behaviour, the secret dialog's route-leave confirmation;
- test feasibility: WebKit credential stubs, theme toggling for axe, the mock clock, the cross-tab
  end-to-end test;
- parallel-task conflicts and [P] markers;
- keyboard-only and screen-reader passes;
- aliases of generated types, the sort control, the Lighthouse orchestrator, `tsx` for the mock
  server;
- wording, drift, licence-gate scope and traceability fixes.

## Coverage

| Set | Total | Covered |
|---|---|---|
| Functional requirements (FR-001 to FR-093 and FR-001a) | 94 | 94 (100 %) |
| Success criteria | 14 | 14. SC-001 to SC-003, SC-010 and SC-011 are user timings recorded manually (T149). |
| Acceptance scenarios | 79 | 79 |
| Edge cases | 33 | 33 |

There are no unmapped tasks. There is no open constitution violation. The recorded deviations are
IV (default brand colours until API 013) and VI (the smoke suite is not a blocking gate until the
API runs its implementation).

## Remaining items below HIGH

1. **MEDIUM, accepted:** the smoke job becomes a merge gate only when the API's dev stack runs its
   implementation (T150).
2. **MEDIUM, coordination:** the API's nginx must redirect `/ng` to `/ng/` and pass the original
   URI through. Passed to the API 001 implementation.
3. **LOW:** the problem-type check reads response descriptions until it switches to the
   now-registered `KnownProblemType`.
4. **LOW, accepted:** one passkey challenge per session affects conditional UI across tabs (silent
   restart).

## Orchestrator decisions on owner questions

1. Typeface: system fonts. TailAdmin's Outfit is licensed under OFL, which the FSF considers
   GPL-incompatible.
2. Image: `ghcr.io/feldsam-inc/mailcowui-ng`, tagged from `v*` git tags.
3. The CI smoke job uses a `MAILCOW_REST_V2_TOKEN` secret only if one is needed, and is skipped
   without it.
4. The new Czech and Slovak strings are reviewed by the owner before the first release.
