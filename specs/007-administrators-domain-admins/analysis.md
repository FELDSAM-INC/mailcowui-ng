# Analysis: UI feature 007 Administrators and domain administrators

The plan agent had an independent read-only reviewer run the analysis twice. The orchestrator
recorded the results here, because the harness would not let the subagent write this file.

## Result

- **Pass 1:** 0 CRITICAL, 7 HIGH, 13 MEDIUM and 13 LOW, against 75 FRs, 45 acceptance scenarios and
  10 SCs. All fixed. The HIGH findings were:
  - identity on tab focus;
  - a deactivation confirmation;
  - passwords in the mutation cache;
  - the coverage manifest;
  - a duplicated domain picker;
  - the legacy key count;
  - the password policy blocking submission.
- **Pass 2:** 4 new HIGH findings from conventions added during the run: `meta.public`, UI 005's
  component names, `useSecretRequest` and `dispatchProblemReactions()`, and UI 014's route names.
  All fixed (`cfd129d`).

## Remaining (below HIGH)

- FR-060 names only the current account unless optional API gap G38 is done.
- The paths of UI 003, 004 and 005 files are taken from their plans. T038 promotes UI 003's
  pre-hashed check if it is still feature-local.

## Orchestrator decisions on owner questions

1. A non-consuming token read is tracked as optional API gap G38. Without it, the landing names only
   the current account.
2. A tab does not re-check the identity on focus (UI 001 FR-033). The cross-tab message carries the
   change.
3. The landing address for billing panels is
   `https://<host>/ng/sign-in/sso-token?sso_token=<token>`.
