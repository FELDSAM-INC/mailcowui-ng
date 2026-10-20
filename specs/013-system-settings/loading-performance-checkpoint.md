# Settings loading performance checkpoint

The first combined 23975541 Lighthouse collection passed accessibility (99–100) but failed
performance on several pages. Its largest layout shifts came from the announcement loading
above already-rendered content and the root bookmark mounting a loading page before redirecting
to the administrator dashboard.

The announcement is now part of the initial shell. The session guard resolves the role-specific
root destination before navigation completes; requested deep links still take precedence.
Route registration imports each feature's route definitions directly, keeping unrelated feature
API/composable exports out of the startup graph.

The root Lighthouse scenario now seeds monitoring data for System & Containers. The old
Home-only script-transfer assertion no longer applies to that dashboard destination; it uses
the direct dashboard's checks and per-chunk budget. The shared initial JavaScript ceiling stays
204,800 bytes gzip, and performance/accessibility thresholds remain 80/90 everywhere.

Verification so far:

- 73 router/shell checks pass, including all three role destinations before the first completed
  navigation. Scoped lint, formatting and production build pass.
- Initial JavaScript after narrowing route imports: 187,389 / 204,800 bytes gzip.
- The announcement/redirect diagnostic reduced layout shift to roughly 0.006–0.018 from up to
  0.743. Sign-in scored 83–87 with accessibility 100. Dashboard and Domains remained below 80
  during concurrent browser work, so the performance gate remains open pending a quiet complete
  collection. No performance threshold was reduced.
- HTML rendering enforcement also passed full repository lint and 21 focused checks.

Evidence: `mailcow-rest-v2/storage/app/restart-2026-10-20/settings-integration/` contains the
initial and diagnostic Lighthouse reports, including failures. The final release checkpoint
must record the complete collection's outcome; this document does not claim deployment.
