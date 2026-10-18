# Specification Quality Checklist: Cutover from the Classic Interface

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-18
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
- Validation iteration 1 (specify) found and fixed four issues:
  - FR-031 used a double negative.
  - Cross-references by number to sibling UI specs being written in parallel had shifted (UI 005's
    reset page is no longer FR-033). They now name the behaviour instead. UI 001 numbers were
    re-checked and still match.
  - SC-008's "within 5 %" was ambiguous. It now compares the daily count with the baseline's daily
    average.
  - The target of `/admin/system` now follows the same "first section of the classic page" rule as
    `/admin/mailbox`.

  After the fixes, all items pass.
- Classic addresses (paths such as `/admin/queue`, `.php` forms, query parameters) are the subject
  of this feature, so they appear in the mapping and exclusion tables. They describe what users and
  external systems request, not how the redirect is built. "Web server", "reload" and "access
  records" name operational concepts the operator already uses. Web server template file names
  appear only in the Legacy Parity references. The app's base address `/ng/` is quoted from
  mailcow-rest-v2 feature 001's plan, not decided here.
- SC-002 compares answers by status and content type. These are observable properties of an answer,
  used so that the smoke test can verify "unchanged" without credentials.
- Clarify session 2026-10-18 recorded 11 decisions (Clarifications section), including the
  orchestrator input on `/api/v1` keys. All items were re-validated after clarify and still pass.
