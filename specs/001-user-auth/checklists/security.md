# Security Requirements Quality Checklist: User Authentication System

**Purpose**: Validate that the authentication-system requirements in [spec.md](../spec.md) are complete, clear, consistent, measurable, and free of ambiguity from a security perspective. This is a **release-gate** checklist for PR reviewers.

**Created**: 2026-05-08  
**Feature**: [spec.md](../spec.md)  
**Audience**: Reviewer (PR / pre-merge)

> Each item tests the **requirements**, not the implementation. References use `[Spec §FR-…]` / `[Spec §SC-…]` / `[Plan]` / `[Gap]` / `[Ambiguity]` / `[Conflict]` / `[Assumption]`.

## Credential Storage & Handling

- [ ] CHK001 - Are password storage requirements specified with a named one-way hashing scheme and a minimum work factor? [Clarity, Spec §FR-004 / Plan §Tech Context]
- [ ] CHK002 - Is the prohibition on persisting or logging plaintext passwords stated unambiguously and applied to **all** code paths (registration, sign-in, reset, audit, error logs)? [Coverage, Spec §FR-004, §SC-006]
- [ ] CHK003 - Are password-strength requirements quantified (length, character classes) rather than relying on adjectives like "strong"? [Clarity, Spec §FR-003 / Assumptions]
- [ ] CHK004 - Is the redaction policy for request bodies in logs (fields `password`, `newPassword`, `token`) stated as a requirement and not only as an implementation note? [Gap, Plan §Foundational]

## Token & Session Requirements

- [ ] CHK005 - Are session credential format and signing-algorithm requirements specified, including key length and rotation expectations? [Completeness, Spec §FR-006..§FR-008 / Plan §Research §1–§2]
- [ ] CHK006 - Is the 24-hour session expiry requirement stated as an **absolute** cap (not sliding) and free of contradictory wording elsewhere? [Consistency, Spec §FR-007, §Edge Cases, §Assumptions]
- [ ] CHK007 - Are immediate-revocation requirements for sign-out and password-change clearly specified and consistent? [Consistency, Spec §FR-008, §FR-015]
- [ ] CHK008 - Are entropy and storage-at-rest requirements specified for one-time secrets (verification, reset)? [Gap, Spec §FR-005a..§FR-005c, §FR-012..§FR-014]
- [ ] CHK009 - Are token expiry windows quantified (verification: 24 h; reset: 1 h) and stated as MUST? [Clarity, Spec §FR-005b, §FR-014, §Assumptions]
- [ ] CHK010 - Is the single-use property of verification and reset tokens stated as a requirement, including the behavior on re-use? [Completeness, Spec §FR-005b, §FR-014]

## Account State, Lockout & Brute-Force Resistance

- [ ] CHK011 - Are brute-force thresholds, observation window, and lockout duration each quantified with units? [Clarity, Spec §FR-010, §FR-010a, §SC-007]
- [ ] CHK012 - Are lockout-recovery paths (timed expiry **and** password-reset) specified consistently and without conflict? [Consistency, Spec §FR-010b, §SC-007, §Edge Cases]
- [ ] CHK013 - Are the requirements for the lockout counter's sliding-window reset behavior explicit (when does the count reset)? [Ambiguity, Spec §FR-010, §FR-010a]
- [ ] CHK014 - Is the requirement for invalidating all live sessions on lockout (defence-in-depth) stated, or is it intentionally excluded? [Gap, Spec §FR-010a]

## Account Enumeration & Information Disclosure

- [ ] CHK015 - Are non-enumerating response requirements specified for **every** email-touching endpoint (registration, sign-in, verify resend, reset request)? [Coverage, Spec §FR-005, §FR-009, §FR-013, §FR-005c]
- [ ] CHK016 - Is the SC-005 timing-equivalence requirement quantified with a numeric threshold and applied to known vs. unknown email paths? [Measurability, Spec §SC-005]
- [ ] CHK017 - Are sign-in error-message requirements stated to forbid disclosing which field was wrong, with a generic-message wording rule? [Clarity, Spec §FR-009]
- [ ] CHK018 - Are the requirements for *unverified-account* sign-in responses defined in a way that does not leak verification state to enumerators? [Ambiguity, Spec §FR-006, §FR-005a]

## Email Verification

- [ ] CHK019 - Are the entry conditions, success conditions, and side-effects of email verification documented as discrete requirements? [Completeness, Spec §FR-005a..§FR-005c, User Story 1]
- [ ] CHK020 - Is the requirement that issuing a new verification link invalidates prior unused links stated as MUST? [Clarity, Spec §FR-005c]
- [ ] CHK021 - Are throttling requirements for resend-verification quantified (cooldown, rate)? [Gap, Spec §FR-005c, §Assumptions]

## Password Reset

- [ ] CHK022 - Is the requirement that a successful password change invalidates **all** existing sessions stated unconditionally? [Clarity, Spec §FR-015]
- [ ] CHK023 - Is the requirement that a successful password change clears any active lockout stated, and is it consistent with FR-010b? [Consistency, Spec §FR-010b, §FR-015]
- [ ] CHK024 - Is the response-shape and timing parity requirement between reset-request for known and unknown emails explicitly tied to SC-005? [Traceability, Spec §FR-013, §SC-005]

## Notifications & Audit

- [ ] CHK025 - Are the discrete events triggering security notification emails enumerated exactly (password change, reset completion, lockout) and deduplicated? [Completeness, Spec §FR-016a]
- [ ] CHK026 - Is the SC-009 dispatch SLO (≤ 60 s) measurable and tied to an audit-to-mailer correlation requirement? [Measurability, Spec §SC-009, §FR-016a]
- [ ] CHK027 - Are audit-event types enumerated and consistent between the FR list and the Key Entities section? [Consistency, Spec §FR-016, Key Entities → Security Audit Event]
- [ ] CHK028 - Are audit-event metadata requirements explicit about what MUST NOT be recorded (credentials, raw tokens, full IP)? [Gap, Spec §FR-016]

## Transport & Cross-Cutting

- [ ] CHK029 - Is the encrypted-transport requirement (FR-017) stated for **all** authentication-related interactions and not weakened elsewhere? [Consistency, Spec §FR-017]
- [ ] CHK030 - Are rate-limiting requirements specified per-endpoint (login, register, verify resend, reset request, reset confirm) rather than as a single blanket rule? [Completeness, Spec §FR-010, Plan §Research §8]
- [ ] CHK031 - Are user-facing error messages required to avoid leaking sensitive details, with this rule applied uniformly across all failure cases? [Clarity, Spec §FR-018]

## Out-of-Scope Boundaries & Assumptions

- [ ] CHK032 - Is the v1 exclusion of MFA, social login, and account deletion stated explicitly and tied to a follow-up plan? [Completeness, Spec §Assumptions, §Clarifications]
- [ ] CHK033 - Are the assumptions about the external transactional email service (deliverability, bounces) documented and validated as in-scope dependencies? [Assumption, Spec §Assumptions]
- [ ] CHK034 - Are no-cap concurrent-session requirements stated as an explicit decision (rather than an oversight)? [Clarity, Spec §Clarifications, §Edge Cases]

## Notes

- 34 items. Mark each with `[x]` only when the **requirement text** in the spec satisfies the question — do not check based on planned or implemented behavior.
- Items flagged `[Gap]` indicate the spec should be amended via `/speckit.clarify` before merging the implementation that depends on them.
