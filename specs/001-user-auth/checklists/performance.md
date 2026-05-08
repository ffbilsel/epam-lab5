# Performance & NFR Requirements Quality Checklist: User Authentication System

**Purpose**: Validate that the non-functional / performance requirements in [spec.md](../spec.md) and [plan.md](../plan.md) are quantified, measurable, scoped, and consistent. **Release-gate** checklist for PR reviewers.

**Created**: 2026-05-08  
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md)  
**Audience**: Reviewer (PR / pre-merge)

> Each item tests requirement quality (measurable? scoped? testable?), not implementation behavior.

## Quantification

- [ ] CHK001 - Are all latency targets stated with explicit percentile and unit (e.g., p95 / ms)? [Measurability, Plan §Tech Context, Spec §SC-002]
- [ ] CHK002 - Is the registration end-to-end target (SC-001 < 2 min) defined as user-visible elapsed time and includes verification email handling? [Clarity, Spec §SC-001]
- [ ] CHK003 - Is the SC-003 "session rejected within 1 minute of expiry" requirement quantified with both the trigger event and the maximum staleness window? [Clarity, Spec §SC-003]
- [ ] CHK004 - Is the SC-005 timing-equivalence threshold (≤ 100 ms variance) tied to a specific measurement methodology? [Measurability, Spec §SC-005]
- [ ] CHK005 - Is the SC-009 notification-dispatch SLO (≤ 60 s) defined with a clear start/stop event for measurement? [Measurability, Spec §SC-009]

## Throughput & Scale

- [ ] CHK006 - Is the scale-target (200 req/s steady on a single instance) tied to a specific endpoint mix? [Clarity, Plan §Tech Context]
- [ ] CHK007 - Are concurrency assumptions (no cap on concurrent sessions per account) reflected in throughput requirements? [Consistency, Spec §Clarifications, Plan]
- [ ] CHK008 - Is the v1 user-base scale ("tens of thousands") quantified with a numeric upper bound for capacity planning? [Clarity, Plan §Tech Context]

## Bcrypt Cost vs. Latency Trade-off

- [ ] CHK009 - Is the bcrypt cost-factor requirement (and the resulting per-hash latency budget) quantified, and reconciled with the sign-in p95 latency target? [Consistency, Plan §Constraints, §Research §3]
- [ ] CHK010 - Is there a stated requirement that bcrypt cost is environment-tunable with a documented floor? [Clarity, Plan §Research §3]

## Asynchronous Email Dispatch

- [ ] CHK011 - Is the requirement that HTTP responses MUST NOT block on SMTP latency stated as a measurable bound (HTTP < 500 ms even on slow SMTP)? [Measurability, Plan §Constraints]
- [ ] CHK012 - Is the relationship between async email dispatch and the SC-009 ≤ 60 s SLO consistent (async, but bounded)? [Consistency, Plan §Constraints, Spec §SC-009]
- [ ] CHK013 - Are retry/backoff requirements specified for transient SMTP failures, or explicitly delegated to the email service? [Gap, Plan §Research §4, Spec §Assumptions]

## Coverage of Critical Journeys

- [ ] CHK014 - Are performance targets defined for **each** critical user journey (register, sign-in, verify, reset, lockout) and not only the aggregate? [Coverage, Spec §SC-001..§SC-009]
- [ ] CHK015 - Is the verify-link click-to-account-active latency target documented? [Gap, Spec §User Story 1]
- [ ] CHK016 - Is the reset confirmation end-to-end latency target documented (token submit → password updated → notification dispatched)? [Gap, Spec §User Story 3]

## Degradation & Failure-Mode NFRs

- [ ] CHK017 - Are graceful-degradation requirements specified for SMTP outage (does sign-in still work? does registration queue?)? [Coverage, Gap]
- [ ] CHK018 - Are degradation requirements specified for Postgres unavailability (read-only? full reject? user-visible error shape?)? [Coverage, Gap]
- [ ] CHK019 - Are time-source / clock-skew tolerances specified for JWT validation across server fleet? [Gap, Spec §Edge Cases]

## Reliability, Availability, Observability

- [ ] CHK020 - Is an availability target (e.g., 99.x % monthly) stated, or explicitly deferred to platform NFRs? [Gap]
- [ ] CHK021 - Are structured-logging and metric requirements specified (event names, fields, cardinality bounds)? [Completeness, Spec §FR-016 / Plan §Foundational]
- [ ] CHK022 - Is the redaction requirement for sensitive fields in logs measurable (which fields, in which sinks)? [Measurability, Spec §SC-006]
- [ ] CHK023 - Are tracing requirements (request-ID propagation through async email path) specified? [Gap]

## Security Performance Trade-offs

- [ ] CHK024 - Is the dummy-bcrypt timing-equalization technique (research.md §7 / SC-005) stated as a behavioral requirement or only as an implementation note? [Clarity, Plan §Research §7]
- [ ] CHK025 - Are rate-limit policies quantified with both threshold and window per endpoint? [Measurability, Plan §Research §8]

## Coverage Gate (Constitutional NFR)

- [ ] CHK026 - Is the ≥ 80 % business-logic coverage requirement traceable to a specific path glob and enforced by config (not honor system)? [Measurability, .specify/memory/constitution.md §III, Plan §Constitution Check #3]

## Notes

- 26 items. NFRs that are stated only as adjectives ("fast", "scalable") in the spec must be flagged `[Ambiguity]` and clarified.
