# API Contract Requirements Quality Checklist: User Authentication System

**Purpose**: Validate that the HTTP-contract requirements implied by [spec.md](../spec.md) and made concrete in [contracts/openapi.yaml](../contracts/openapi.yaml) are complete, clear, consistent, and testable. This is a **release-gate** checklist for PR reviewers.

**Created**: 2026-05-08  
**Feature**: [spec.md](../spec.md) · [contracts/openapi.yaml](../contracts/openapi.yaml)  
**Audience**: Reviewer (PR / pre-merge)

> Each item tests the **requirements/contract**, not the implementation.

## Endpoint Coverage & Mapping

- [ ] CHK001 - Does every functional requirement that implies an HTTP interaction map to a documented endpoint in the contract? [Coverage, Spec §FR-001..§FR-018]
- [ ] CHK002 - Is each user story (US1, US2, US3) traceable to the specific endpoints that satisfy it? [Traceability, Spec §User Stories]
- [ ] CHK003 - Are all endpoints listed in the contract justified by a spec FR (no orphan endpoints)? [Consistency, contracts/openapi.yaml]

## Request & Response Shape

- [ ] CHK004 - Are request body schemas defined for every state-mutating endpoint with required fields, types, and bounds? [Completeness, contracts/openapi.yaml]
- [ ] CHK005 - Is the `Email` schema requirement (format + max length) stated once and reused consistently across endpoints? [Consistency, contracts/openapi.yaml §components.schemas.Email]
- [ ] CHK006 - Are password-field requirements (min/max length, character classes) stated in the contract and consistent with FR-003? [Consistency, Spec §FR-003 / contracts/openapi.yaml §components.schemas.Password]
- [ ] CHK007 - Is the success response shape for sign-in (`{token, expiresAt}`) specified with explicit types and timestamp format? [Clarity, Spec §FR-006 / contracts/openapi.yaml §Session]

## Status Codes & Semantics

- [ ] CHK008 - Are the success status codes for non-enumerating endpoints (`/auth/register`, `/auth/verify/resend`, `/auth/reset/request`) standardized as 202 with an identical `GenericAck` body? [Consistency, Spec §FR-005, §FR-013]
- [ ] CHK009 - Is the distinction between 401 (auth failure) and 423 (lockout) clearly specified in the contract and tied to FR-009/FR-010a? [Clarity, Spec §FR-009, §FR-010a]
- [ ] CHK010 - Are 410 responses for expired/used verification and reset tokens documented as the canonical "gone" semantic? [Consistency, Spec §FR-005b, §FR-014]
- [ ] CHK011 - Is the use of 429 for rate-limited endpoints specified uniformly wherever throttling is a requirement? [Coverage, Spec §FR-010, §FR-005c]

## Error Format

- [ ] CHK012 - Are all error responses required to use RFC 7807 `application/problem+json`, and is this stated as a requirement (not just an example)? [Clarity, contracts/openapi.yaml §components.schemas.Problem]
- [ ] CHK013 - Are the `type`, `title`, `status` fields of the Problem schema required (not optional), and is `detail`'s allowed information disclosure constrained? [Consistency, Spec §FR-018]
- [ ] CHK014 - Is there an explicit requirement that error bodies do not leak which credential field was wrong? [Clarity, Spec §FR-009 / §FR-018]

## Authentication & Authorization

- [ ] CHK015 - Are protected endpoints (`/auth/logout`, `/me`) explicitly marked as requiring `bearerAuth` in the contract? [Completeness, contracts/openapi.yaml §security]
- [ ] CHK016 - Is the bearer-token format (JWT) and the `Authorization: Bearer <token>` placement documented as a requirement? [Clarity, contracts/openapi.yaml §securitySchemes.bearerAuth]
- [ ] CHK017 - Is the requirement that a revoked `jti` causes 401 within ≤ 1 minute (per SC-003) traceable to a contract behavior? [Traceability, Spec §SC-003, §FR-008]

## Idempotency & Side Effects

- [ ] CHK018 - Are the idempotency expectations of `POST /auth/verify` and `POST /auth/reset/confirm` (single-use tokens) stated in the contract? [Completeness, Spec §FR-005b, §FR-014]
- [ ] CHK019 - Is the side effect "all live sessions revoked on password change" reflected in the contract description for `/auth/reset/confirm`? [Consistency, Spec §FR-015]
- [ ] CHK020 - Is the side effect "lockout cleared on successful reset" reflected in the contract description for `/auth/reset/confirm`? [Consistency, Spec §FR-010b]

## Rate Limiting

- [ ] CHK021 - Are the endpoints that MUST be rate-limited enumerated, and are headers (`Retry-After`, `RateLimit-*`) on 429 responses specified? [Gap, Spec §FR-010]
- [ ] CHK022 - Is the rate-limit policy granularity (per-IP, per-account, or both) stated as a requirement? [Clarity, Plan §Research §8]

## Versioning & Compatibility

- [ ] CHK023 - Is an API versioning strategy documented (URL prefix, header, or contract field)? [Gap, contracts/openapi.yaml §info.version]
- [ ] CHK024 - Is the breaking-change policy aligned with the constitution's versioning policy? [Consistency, .specify/memory/constitution.md §Governance]

## Content Negotiation

- [ ] CHK025 - Is `application/json` requirement for request bodies documented and enforced uniformly? [Consistency, contracts/openapi.yaml]
- [ ] CHK026 - Is the `application/problem+json` content type specified for every error response (not only some)? [Coverage, contracts/openapi.yaml §responses]

## Test-Contract Traceability

- [ ] CHK027 - Are integration-test tasks (T030, T042, T052) explicitly tied to the contract endpoints they exercise? [Traceability, tasks.md / contracts/openapi.yaml]
- [ ] CHK028 - Is there a requirement that the contract is the single source of truth for HTTP shape (i.e., schemas/middleware derive from it)? [Gap, Plan]

## Notes

- 28 items. Check `[x]` only when the contract or spec text answers the question affirmatively; flag `[Gap]` items via `/speckit.clarify` if needed.
