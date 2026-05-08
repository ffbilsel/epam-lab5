# UX & Messaging Requirements Quality Checklist: User Authentication System

**Purpose**: Validate that user-facing UX, messaging, and state-flow requirements in [spec.md](../spec.md) are complete, clear, consistent, and accessible. **Release-gate** checklist for PR reviewers.

**Created**: 2026-05-08  
**Feature**: [spec.md](../spec.md)  
**Audience**: Reviewer (PR / pre-merge)

> Each item tests requirement quality, not implementation behavior. References use `[Spec §FR-…]`, `[Gap]`, `[Ambiguity]`, `[Consistency]`.

## State-Flow Coverage

- [ ] CHK001 - Are user-visible states for an account (`unverified`, `active`, `locked`) enumerated and traceable to FRs? [Completeness, Spec §Key Entities, §FR-005a, §FR-010a]
- [ ] CHK002 - Are the user-visible state transitions documented (register → unverified → verify → active → lockout → unlock)? [Coverage, Spec §User Stories, §Edge Cases]
- [ ] CHK003 - Are the user-visible outcomes specified for each acceptance scenario (success message, error message, redirect target)? [Completeness, Spec §User Story 1..§User Story 3]

## Messaging Requirements

- [ ] CHK004 - Is the wording requirement for "duplicate email" non-enumerating responses specified (what the user sees vs. what is logged)? [Clarity, Spec §FR-005]
- [ ] CHK005 - Is the wording requirement for the "incorrect credentials" generic message specified, including the rule against disclosing which field was wrong? [Clarity, Spec §FR-009]
- [ ] CHK006 - Is the wording requirement for the unverified-account sign-in attempt specified, including the call-to-action (resend link)? [Completeness, Spec §FR-006]
- [ ] CHK007 - Is the wording requirement for the lockout response specified (does it disclose remaining lockout time, or only that the account is locked)? [Ambiguity, Spec §FR-010a, §Edge Cases]
- [ ] CHK008 - Is the wording requirement for "expired/used token" responses specified across both verification and reset flows? [Consistency, Spec §FR-005b, §FR-014]
- [ ] CHK009 - Are the contents of security-notification emails (subject lines, body summary, recommended next steps) specified at requirement level? [Gap, Spec §FR-016a]

## Empty / Loading / Async States

- [ ] CHK010 - Are loading-state requirements specified for sign-in submission (button state, retry semantics)? [Gap, Spec §User Story 2]
- [ ] CHK011 - Are post-registration screen requirements specified (what the user sees while awaiting the verification email)? [Gap, Spec §User Story 1]
- [ ] CHK012 - Are post-reset-request screen requirements specified, including the non-enumerating message? [Coverage, Spec §FR-013]

## Edge Cases & Error Recovery (UX)

- [ ] CHK013 - Are user-recovery requirements specified for "verification email never arrived"? [Coverage, Spec §FR-005c, §Edge Cases]
- [ ] CHK014 - Are user-recovery requirements specified for "reset email never arrived"? [Coverage, Spec §Edge Cases]
- [ ] CHK015 - Are user-recovery requirements specified for "session expired mid-action"? [Clarity, Spec §Edge Cases]
- [ ] CHK016 - Are user-facing requirements specified for the "another device signed me out" scenario, given that no cap exists on concurrent sessions? [Clarity, Spec §Clarifications, §Edge Cases]

## Accessibility & Localization

- [ ] CHK017 - Are accessibility requirements (form labelling, error-text association, focus management on submit) specified for the auth forms? [Gap]
- [ ] CHK018 - Are color-independent error indication requirements specified (errors not conveyed by color alone)? [Gap]
- [ ] CHK019 - Are localization requirements stated explicitly (single locale for v1) and tied to email copy as well? [Consistency, Spec §Assumptions]

## Consistency & Terminology

- [ ] CHK020 - Are user-facing terms used consistently (e.g., "sign in" vs. "log in", "session" vs. "token", "verification" vs. "confirmation")? [Consistency, Spec §entire]
- [ ] CHK021 - Is the canonical name for the system's account concept ("User Account") used uniformly across spec, plan, and contract? [Consistency, Spec §Key Entities, Plan, contracts/openapi.yaml]
- [ ] CHK022 - Are time-bound user-visible figures (24-hour session, 1-hour reset, 24-hour verify, 15-minute lockout) consistent across spec, plan, and quickstart? [Consistency, Spec §Assumptions / Plan §Tech Context / quickstart.md]

## Security/UX Trade-offs

- [ ] CHK023 - Are requirements specified that prevent UX shortcuts from leaking account existence (e.g., field-level error highlighting)? [Coverage, Spec §FR-009, §FR-013]
- [ ] CHK024 - Are requirements specified for clipboard / autofill behavior of password and token fields? [Gap]

## Notes

- 24 items. UX gaps in requirements are common — flag missing items with `[Gap]` and feed them back via `/speckit.clarify` rather than guessing during implementation.
