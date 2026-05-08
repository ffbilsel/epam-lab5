---
description: "Task list for User Authentication System (feature 001-user-auth)"
---

# Tasks: User Authentication System

**Input**: Design documents from [specs/001-user-auth/](.)
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml), [quickstart.md](./quickstart.md)

**Tests**: INCLUDED. The project constitution (`.specify/memory/constitution.md` v1.0.0, Principle III) mandates the Testing Pyramid with ≥ 80% line/branch coverage on `src/domain/**` and `src/services/**`. Tests are written before the corresponding implementation task within each story.

**Organization**: Tasks are grouped by user story (US1 = register, US2 = sign-in/session, US3 = password reset) so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different file, no dependency on a prior incomplete task in this phase — safe to run in parallel.
- **[Story]**: User story label (US1/US2/US3); only present in story phases.
- All paths are repository-relative; backend lives at `backend/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the TypeScript/Express backend project and the toolchain that the constitution requires.

- [ ] T001 Create the `backend/` directory structure exactly as defined in [plan.md](./plan.md#source-code-repository-root) (`src/{config,domain,services,repositories,http/{routes,middleware,schemas},infra,lib}`, `migrations/`, `tests/{unit,integration,e2e}`).
- [ ] T002 Initialize the Node project: create `backend/package.json` with Node 20 engines field; install runtime deps (`express@^4`, `pg@^8`, `bcrypt@^5`, `jsonwebtoken@^9`, `zod`, `pino`, `nodemailer@^6`, `helmet`, `express-rate-limit`, `cookie-parser`) and dev deps (`typescript@~5.4`, `@types/node`, `@types/express`, `@types/jsonwebtoken`, `@types/bcrypt`, `@types/pg`, `@types/supertest`, `ts-jest`, `jest@^29`, `supertest`, `testcontainers`, `tsx`, `node-pg-migrate`, `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-jsdoc`, `prettier`); commit `package-lock.json`.
- [ ] T003 [P] Create `backend/tsconfig.json` with the full strict family required by Constitution Principle II: `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`, `"noFallthroughCasesInSwitch": true`, `"exactOptionalPropertyTypes": true`, `"target": "ES2022"`, `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"outDir": "dist"`, `"rootDir": "src"`.
- [ ] T004 [P] Create `backend/.eslintrc.cjs` extending `@typescript-eslint/recommended-type-checked`, enabling `eslint-plugin-jsdoc` with `jsdoc/require-jsdoc` for exported functions/classes/types, banning `any`, non-null `!`, and `@ts-ignore`; create `backend/.prettierrc` with project formatting.
- [ ] T005 [P] Create `backend/jest.config.ts` with three `projects` (`unit`, `integration`, `e2e`) using `ts-jest`; set `coverageThreshold` for `src/domain/**` and `src/services/**` to `{ lines: 80, branches: 80, functions: 80, statements: 80 }`; add `coveragePathIgnorePatterns` excluding `src/infra/**`, `src/server.ts`, `src/app.ts`.
- [ ] T006 [P] Add npm scripts to `backend/package.json`: `"dev"`, `"build"`, `"migrate:up"`, `"migrate:down"`, `"test"`, `"test:unit"`, `"test:integration"`, `"test:e2e"`, `"check"` (chained: `tsc --noEmit && eslint . && prettier --check . && jest --coverage`).
- [ ] T007 [P] Create `backend/.env.example` exactly matching the variables listed in [quickstart.md §1](./quickstart.md#1-install--configure).
- [ ] T008 [P] Create `backend/README.md` linking to [quickstart.md](./quickstart.md), [plan.md](./plan.md), and [.specify/memory/constitution.md](../../.specify/memory/constitution.md).

**Checkpoint**: Toolchain compiles an empty `src/index.ts` with `npm run check` passing on a no-op project.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the cross-cutting infrastructure every user story depends on (config, DB, schema, middleware, auth scaffolding). No story can begin until this phase is complete.

⚠️ CRITICAL: blocks all of Phase 3, 4, 5.

- [ ] T009 Implement Zod-validated environment config at `backend/src/config/env.ts` — load and parse `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `BCRYPT_COST`, `SMTP_URL`, `EMAIL_FROM`, `RESET_TOKEN_TTL_SECONDS`, `VERIFY_TOKEN_TTL_SECONDS`, `LOCKOUT_THRESHOLD`, `LOCKOUT_WINDOW_SECONDS`, `LOCKOUT_DURATION_SECONDS`; export a single frozen `env` object; process.exit(1) on parse failure.
- [ ] T010 [P] Implement `backend/src/infra/db.ts` — `pg` `Pool` factory consuming `env.DATABASE_URL`, with a `withTx<T>(fn)` helper for transactional repository operations.
- [ ] T011 [P] Implement `backend/src/infra/clock.ts` — `Clock` interface with `now(): Date`; export `systemClock` and `fixedClock(date)` for tests (per research.md §10).
- [ ] T012 [P] Implement `backend/src/infra/hasher.ts` — async `hash(password)` and `verify(password, hash)` wrapping `bcrypt` using `env.BCRYPT_COST` (research.md §3).
- [ ] T013 [P] Implement `backend/src/lib/crypto.ts` — `generateToken()` returns 32 random bytes base64url-encoded; `hashToken(raw)` returns SHA-256 hex (research.md §6).
- [ ] T014 [P] Implement `backend/src/infra/mailer.ts` — `nodemailer` SMTP transport from `env.SMTP_URL` plus a `sendEmail({to, subject, text, html})` function that fires-and-logs (async dispatch per research.md §4); export a `jsonTransport`-backed factory for tests.
- [ ] T015 [P] Create migration `backend/migrations/001_init_auth.sql` — enable `pgcrypto` and `citext`, create the five tables (`users`, `email_verifications`, `sessions`, `password_resets`, `audit_events`) with all columns, constraints, and indexes specified in [data-model.md](./data-model.md). Configure `node-pg-migrate` to run it via `npm run migrate:up`.
- [ ] T016 Implement `backend/src/domain/errors.ts` — typed error classes: `ValidationError`, `UnauthorizedError`, `LockedError`, `GoneError` (expired/used token), `TooManyRequestsError`; each carries an RFC 7807 `type`, `title`, `status`.
- [ ] T017 [P] Implement `backend/src/http/middleware/error-handler.ts` — Express error middleware that maps the domain error classes from T016 to RFC 7807 `application/problem+json` responses; redacts unexpected errors to a generic 500.
- [ ] T018 [P] Implement `backend/src/http/middleware/validate.ts` — generic Zod request validator: `validate({ body?, query?, params? })` returns Express middleware that 400s on parse failure via `ValidationError`.
- [ ] T019 [P] Implement `backend/src/http/middleware/rate-limit.ts` — factory wrapping `express-rate-limit` configured per-route per research.md §8; defaults pulled from env.
- [ ] T020 Implement `backend/src/app.ts` — Express app factory: `helmet`, JSON body parser, `cookie-parser`, request-ID + `pino-http` logger that redacts `password`/`newPassword`/`token` fields, mounts routes (placeholder for now), terminates with `error-handler` from T017. **No `listen` call.**
- [ ] T021 Implement `backend/src/server.ts` — bootstraps `app` from T020, listens on `env.PORT`, wires graceful shutdown (SIGTERM/SIGINT close the pool and HTTP server).
- [ ] T022 Implement `backend/src/repositories/audit.repo.ts` — `record(event: AuditEvent)` insert; pure SQL, parameterized; rows parsed via Zod on read.
- [ ] T023 [P] Implement `backend/src/services/notification.service.ts` — `notifyPasswordChanged(user)`, `notifyResetCompleted(user)`, `notifyAccountLocked(user)`; deduplicates per discrete event id (FR-016a) and dispatches via `mailer` from T014.
- [ ] T024 [P] **Unit tests** in `backend/tests/unit/infra/hasher.test.ts` and `backend/tests/unit/lib/crypto.test.ts` covering hash/verify round-trip and token entropy/length.
- [ ] T025 [P] **Unit tests** in `backend/tests/unit/http/middleware/validate.test.ts` and `error-handler.test.ts` covering Zod failure → 400 problem and domain-error → status mapping.
- [ ] T026 [P] **Integration test** in `backend/tests/integration/migrations.test.ts` — spins a Postgres testcontainer, runs migrations up & down, asserts schema matches data-model.md (table list + key constraints).

**Checkpoint**: `npm run check` passes; the empty service starts, `/healthz` returns 200, the DB schema applies cleanly, and all foundation pieces have unit/integration coverage.

---

## Phase 3: User Story 1 — Register a New Account (Priority: P1) 🎯 MVP

**Goal**: A new visitor creates an account with email + password, receives a verification email, and confirms the email — after which the account is allowed to sign in (per spec [User Story 1](./spec.md#user-story-1---register-a-new-account-priority-p1) and FR-001…FR-005c).

**Independent Test**: Run the registration journey from [quickstart.md §4 Journey 1](./quickstart.md#journey-1--register-user-story-1) end-to-end and confirm the account moves from unverified → verified, with the verification email captured by MailHog.

### Tests for User Story 1 (write FIRST, ensure they FAIL)

- [ ] T027 [P] [US1] **Unit tests** in `backend/tests/unit/domain/password-policy.test.ts` covering accept/reject for: too short, no digit, no letter, exactly minimum, max-length boundary.
- [ ] T028 [P] [US1] **Unit tests** in `backend/tests/unit/services/registration.service.test.ts` using in-memory fakes for repos/mailer/clock — covering: happy path issues verification email, duplicate email returns generic ack (no enumeration, FR-005), weak password rejected, raw password never appears in any persisted/returned value.
- [ ] T029 [P] [US1] **Unit tests** in `backend/tests/unit/services/verification.service.test.ts` covering: valid token → account verified + `consumed_at` set + other live tokens invalidated; expired token → `GoneError`; consumed token → `GoneError`; resend invalidates prior unused token (FR-005c).
- [ ] T030 [P] [US1] **Integration tests** in `backend/tests/integration/auth-register.test.ts` (testcontainers) — `POST /auth/register` returns 202 for new and duplicate emails with identical bodies; `POST /auth/verify` succeeds with the issued token; `POST /auth/verify/resend` is throttled and invalidates the prior token.
- [ ] T031 [US1] **E2E test** in `backend/tests/e2e/journey-register.test.ts` — exercises Journey 1 from quickstart.md against the running app + Postgres + jsonTransport mailer; asserts the account becomes able to sign in (anticipates US2 endpoint, may be skipped until US2's `/auth/login` is implemented).

### Implementation for User Story 1

- [ ] T032 [P] [US1] Implement `backend/src/domain/password-policy.ts` — pure `validate(password): Result` enforcing min 8, ≥ 1 letter, ≥ 1 digit (per spec Assumptions); exports a Zod refinement.
- [ ] T033 [P] [US1] Implement `backend/src/repositories/user.repo.ts` — `findByEmail`, `findById`, `insertUnverified`, `markEmailVerified`, `updatePasswordHash`, `clearLockout`, `setLockout`, `incrementFailedAttempts`. Parameterized SQL; rows parsed via Zod schemas defined alongside.
- [ ] T034 [P] [US1] Implement `backend/src/repositories/verification.repo.ts` — `insert`, `findValidByTokenHash`, `markConsumed`, `invalidateAllForUser`. Parameterized SQL.
- [ ] T035 [US1] Implement `backend/src/services/registration.service.ts` — `register({email, password})`:
  1. Validate inputs via password policy (T032).
  2. In a transaction (T010): if email already exists → return generic ack and audit `registration` outcome=`failure`; else hash password (T012), insert unverified user (T033), insert verification request (T034) with `VERIFY_TOKEN_TTL_SECONDS` expiry, audit `registration` outcome=`success`.
  3. Asynchronously dispatch verification email via `mailer` (T014) containing the raw token (only place it appears).
  Depends on: T009, T010, T012, T013, T014, T022, T032, T033, T034.
- [ ] T036 [US1] Implement `backend/src/services/verification.service.ts` — `verify(rawToken)`: hash and look up via T034; reject expired/consumed with `GoneError`; on success mark consumed + set `users.email_verified_at` + invalidate other live tokens for the same user + audit `email_verification_completed`. `resend(email)`: always returns ack; if user exists and is unverified, generate fresh token, invalidate prior unused, dispatch email; subject to caller-side throttling (T038).
- [ ] T037 [P] [US1] Implement `backend/src/http/schemas/register.schemas.ts` — Zod schemas for `RegisterBody`, `VerifyBody`, `ResendVerifyBody` matching [contracts/openapi.yaml](./contracts/openapi.yaml).
- [ ] T038 [US1] Implement `backend/src/http/routes/account.routes.ts` — wire `POST /auth/register` (uses T035), `POST /auth/verify` (uses T036), `POST /auth/verify/resend` (uses T036) with the rate-limit middleware (T019) and validate middleware (T018) using schemas from T037; mount in `app.ts` (T020).

**Checkpoint**: T030 and T031 pass; quickstart.md Journey 1 succeeds end-to-end; coverage on `src/domain/**` and `src/services/**` modules touched here is ≥ 80%.

---

## Phase 4: User Story 2 — Sign In and Maintain a Session (Priority: P1)

**Goal**: A verified user signs in with email + password and receives a JWT session credential valid for 24 hours; sign-out and lockout invalidate sessions immediately (per spec [User Story 2](./spec.md#user-story-2---sign-in-and-maintain-a-session-priority-p1) and FR-006…FR-010b).

**Independent Test**: Run [quickstart.md §4 Journey 2](./quickstart.md#journey-2--sign-in--call-a-protected-endpoint-user-story-2) and Journey 4 (lockout) end-to-end; confirm sign-out immediately invalidates the JWT and 10 failed attempts produce HTTP 423.

### Tests for User Story 2 (write FIRST, ensure they FAIL)

- [ ] T039 [P] [US2] **Unit tests** in `backend/tests/unit/domain/token-claims.test.ts` covering JWT claim shape `{sub, jti, iat, exp, ver}` and `exp = iat + JWT_EXPIRES_IN`.
- [ ] T040 [P] [US2] **Unit tests** in `backend/tests/unit/services/session.service.test.ts` using `fixedClock` (T011) for: `issue()` persists row + signs JWT; `verify()` rejects bad signature, missing jti, revoked jti, expired exp; `revoke(jti)`; `revokeAllForUser(userId)`.
- [ ] T041 [P] [US2] **Unit tests** in `backend/tests/unit/services/auth.service.test.ts` for sign-in: correct credentials on verified account → success; unverified → `UnauthorizedError` with verify-prompt code; wrong password → generic `UnauthorizedError` (FR-009); 10 failures within sliding 10-min window → `LockedError` and `notifyAccountLocked` called once; successful sign-in resets counters.
- [ ] T042 [P] [US2] **Integration tests** in `backend/tests/integration/auth-login.test.ts` covering: `POST /auth/login` returns 200 + JWT for verified+correct, 401 for wrong password, 401 for unverified, 423 after threshold; `POST /auth/logout` returns 204 and the same token then 401s on `/me`; `GET /me` returns 401 within 1 minute of session expiry (`fixedClock` advanced 24h+ε).
- [ ] T043 [US2] **E2E test** in `backend/tests/e2e/journey-login-and-lockout.test.ts` — Journeys 2 + 4 from quickstart.md against the live app.

### Implementation for User Story 2

- [ ] T044 [P] [US2] Implement `backend/src/domain/token-claims.ts` — pure builder/parser for `SessionClaims` and `buildClaims({userId, jti, now, ttlSeconds})`.
- [ ] T045 [P] [US2] Implement `backend/src/repositories/session.repo.ts` — `insert(jti, userId, issuedAt, expiresAt)`, `findActive(jti)`, `revoke(jti)`, `revokeAllActiveForUser(userId)`.
- [ ] T046 [US2] Implement `backend/src/services/session.service.ts` — `issue(userId)`: generate `jti` (uuid), build claims (T044), sign JWT with `env.JWT_SECRET` (HS256), persist via T045; `verify(rawJwt)`: signature + jti-active + expiry checks; `revoke(jti)`; `revokeAllForUser(userId)`. Honors `JWT_SECRET_PREV` for verify-only during rotation (research.md §2).
- [ ] T047 [US2] Implement `backend/src/services/auth.service.ts` — `signIn({email, password})`:
  1. Look up user (T033); if missing → audit failure, return generic `UnauthorizedError`.
  2. If `email_verified_at IS NULL` → return `UnauthorizedError` with verify-prompt machine-readable code.
  3. If `locked_until > now()` → audit failure, return `LockedError` (FR-010a).
  4. `hasher.verify` (T012); on failure update sliding-window counters (T033), if threshold reached set `locked_until = now + LOCKOUT_DURATION_SECONDS`, dispatch `notifyAccountLocked` (T023), audit `account_lockout`, return `LockedError`; otherwise `UnauthorizedError`.
  5. On success: clear counters + lockout, audit `signin` success, call `session.issue` (T046), return `{token, expiresAt}`.
  `signOut(jti)`: `session.revoke(jti)` + audit `signout`.
- [ ] T048 [P] [US2] Implement `backend/src/http/middleware/authenticate.ts` — extract bearer token, call `session.verify` (T046), attach `{userId, jti}` to `req`; on failure throw `UnauthorizedError`.
- [ ] T049 [P] [US2] Implement `backend/src/http/schemas/auth.schemas.ts` — Zod schemas for `LoginBody` and `SessionResponse` matching [contracts/openapi.yaml](./contracts/openapi.yaml).
- [ ] T050 [US2] Implement `backend/src/http/routes/auth.routes.ts` — `POST /auth/login` (rate-limited per-IP+per-account, validates with T049, calls T047), `POST /auth/logout` (uses T048 then T047 `signOut`), `GET /me` (uses T048 then `user.repo.findById`); mount in `app.ts`.

**Checkpoint**: T042 and T043 pass; Journeys 2 and 4 succeed; sign-out and lockout both invalidate the JWT immediately.

---

## Phase 5: User Story 3 — Reset a Forgotten Password via Email (Priority: P2)

**Goal**: A user requests a password reset by email, follows the link, sets a new password — and on success all live sessions are invalidated, lockout is cleared, and a notification email is sent (per spec [User Story 3](./spec.md#user-story-3---reset-a-forgotten-password-via-email-priority-p2) and FR-011…FR-015, FR-016a).

**Independent Test**: Run [quickstart.md §4 Journey 3](./quickstart.md#journey-3--password-reset-user-story-3) end-to-end; confirm the new password works, prior JWT is rejected, and a "password changed" email is captured.

### Tests for User Story 3 (write FIRST, ensure they FAIL)

- [ ] T051 [P] [US3] **Unit tests** in `backend/tests/unit/services/password-reset.service.test.ts` for: `requestReset` always succeeds and is non-enumerating (identical response for known/unknown email, FR-013); `requestReset` for known email persists hashed token + dispatches email; `confirmReset` with valid token updates password, clears lockout, revokes all sessions (mock `session.revokeAllForUser`), dispatches notification, audits `reset_completed`; expired/used token → `GoneError`; weak new password → `ValidationError`.
- [ ] T052 [P] [US3] **Integration tests** in `backend/tests/integration/auth-reset.test.ts` (testcontainers) covering: `POST /auth/reset/request` returns identical 202 body and ≤ 100 ms timing variance for known vs. unknown emails (SC-005); `POST /auth/reset/confirm` succeeds and the prior JWT (issued in setUp) is then rejected by `/me` (FR-015); throttling on both endpoints.
- [ ] T053 [US3] **E2E test** in `backend/tests/e2e/journey-reset.test.ts` — Journey 3 from quickstart.md.

### Implementation for User Story 3

- [ ] T054 [P] [US3] Implement `backend/src/repositories/reset.repo.ts` — `insert`, `findValidByTokenHash`, `markConsumed`. Parameterized SQL.
- [ ] T055 [US3] Implement `backend/src/services/password-reset.service.ts` —
  - `requestReset(email)`: always return generic ack; if user exists, generate token (T013), insert reset row (T054) with `RESET_TOKEN_TTL_SECONDS`, dispatch email; audit `reset_request`. Constant-ish-time path: perform a dummy bcrypt verify or sleep when user is missing to keep timing within 100 ms of the happy path (SC-005).
  - `confirmReset(rawToken, newPassword)`: validate password policy; look up valid reset row, else `GoneError`; in a transaction — mark consumed, hash + update password (T012, T033), clear lockout, call `session.revokeAllForUser` (T046); audit `reset_completed` + `password_changed`; dispatch `notifyPasswordChanged` + `notifyResetCompleted` via T023.
  Depends on: T012, T013, T014, T022, T023, T032, T033, T046, T054.
- [ ] T056 [P] [US3] Implement `backend/src/http/schemas/reset.schemas.ts` — Zod schemas for `ResetRequestBody` and `ResetConfirmBody` matching [contracts/openapi.yaml](./contracts/openapi.yaml).
- [ ] T057 [US3] Implement `backend/src/http/routes/reset.routes.ts` — `POST /auth/reset/request` and `POST /auth/reset/confirm` with rate-limit (T019), validate (T018) via T056, and the service from T055; mount in `app.ts`.

**Checkpoint**: T052 and T053 pass; Journey 3 succeeds; coverage gate still ≥ 80%; SC-005 timing assertion passes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finishing touches that touch multiple stories and verify the constitution gates as a whole.

- [ ] T058 [P] Add `GET /healthz` and `GET /readyz` in `backend/src/http/routes/health.routes.ts` (readiness pings the DB pool); mount in `app.ts`.
- [ ] T059 [P] Audit every exported symbol in `backend/src/**` for JSDoc presence and meaningful descriptions (`@param`, `@returns`, `@throws`); fix any `eslint-plugin-jsdoc` warnings — Constitution Principle IV.
- [ ] T060 [P] Run a coverage report (`npm run check`) and confirm `src/domain/**` and `src/services/**` are ≥ 80% lines/branches; add targeted tests for any uncovered branch (do not relax thresholds).
- [ ] T061 [P] Verify no `any`, no non-null `!`, no `@ts-ignore`, no `console.log` remain in `backend/src/**` (grep + ESLint); replace with typed alternatives or `pino` logger.
- [ ] T062 [P] Add a CI workflow at `.github/workflows/ci.yml` running `npm ci && npm run check` on Node 20, with a Postgres service container for the integration project.
- [ ] T063 Run [quickstart.md](./quickstart.md) end-to-end against a freshly-built container image; record any deltas back into quickstart.md.
- [ ] T064 Update [.github/copilot-instructions.md](../../.github/copilot-instructions.md) "SPECKIT" block if any plan paths changed during implementation.

**Final checkpoint**: `npm run check` is green, all six Constitution gates from [plan.md §Constitution Check](./plan.md#constitution-check) verifiably pass, and all four quickstart journeys (register, sign-in, reset, lockout) run cleanly.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: no dependencies.
- **Phase 2 (Foundational)**: depends on Phase 1; **blocks** Phases 3, 4, 5.
- **Phase 3 (US1)**: depends on Phase 2; independently testable once complete.
- **Phase 4 (US2)**: depends on Phase 2; soft dependency on US1 only because the E2E test (T031) for US1 needs `/auth/login` to fully assert "able to sign in" — US2 may begin in parallel with US1.
- **Phase 5 (US3)**: depends on Phase 2 and Phase 4 (uses `session.service.revokeAllForUser` from T046). May start in parallel with US1.
- **Phase 6 (Polish)**: depends on US1 + US2 + US3.

### Within each user story

- Tests (T027–T031, T039–T043, T051–T053) are **written first** and **must fail** before the matching implementation tasks.
- Repos and pure-domain modules ([P]) before services; services before routes.
- Routes mount in `app.ts` last (the only contention point on `app.ts` — do **not** mark route tasks `[P]` against each other).

### Parallel opportunities

- **Setup**: T003–T008 in parallel after T002.
- **Foundational**: T010–T015, T017–T019, T023–T026 in parallel after T009 + T016 land.
- **US1**: T027–T030 in parallel; T032, T033, T034, T037 in parallel; then T035 → T036 → T038.
- **US2**: T039–T042 in parallel; T044, T045, T048, T049 in parallel; then T046 → T047 → T050.
- **US3**: T051, T052 in parallel; T054, T056 in parallel; then T055 → T057.
- **Polish**: T058–T062 all in parallel; T063 then T064.

### Parallel example — start of US1

```text
# Tests in parallel:
Task: "T027 password-policy unit tests"
Task: "T028 registration.service unit tests"
Task: "T029 verification.service unit tests"
Task: "T030 auth-register integration test"

# Then domain + repos + schemas in parallel:
Task: "T032 password-policy.ts"
Task: "T033 user.repo.ts"
Task: "T034 verification.repo.ts"
Task: "T037 register.schemas.ts"
```

---

## Implementation Strategy

### MVP first (US1 alone is *not* shippable on its own)

Because US1 only enables registration (no sign-in yet), the **shippable MVP is US1 + US2 together**. Recommended order:

1. Phase 1 → Phase 2.
2. Phase 3 (US1) and Phase 4 (US2) in parallel by two developers (or sequentially: US1 then US2).
3. **Validate**: run quickstart Journeys 1, 2, 4 end-to-end → MVP demoable.
4. Phase 5 (US3) → Journey 3 demoable.
5. Phase 6 (Polish) before the first production deploy.

### Incremental delivery

- After Phase 4: register + sign-in + sign-out + lockout (3 of 3 P1 stories shipped).
- After Phase 5: full feature including password reset (P2 shipped).
- After Phase 6: production-ready with CI, JSDoc audit, and coverage gate verified.

### Parallel team strategy

With three developers after Phase 2:

- Dev A: Phase 3 (US1).
- Dev B: Phase 4 (US2) — coordinates with Dev A on `app.ts` mounting and `user.repo.ts` (T033 is owned by Dev A).
- Dev C: Phase 5 (US3) — pulls `session.service` once Dev B publishes T046.

---

## Notes

- `[P]` = different file and no dependency on a prior incomplete task in the same phase.
- All file paths are relative to repo root and exactly match [plan.md](./plan.md#source-code-repository-root).
- Every task either creates or modifies files under `backend/`; no task touches files outside `backend/` except CI workflow (T062) and the agent-context update (T064).
- Tests are required, not optional, for this feature — the constitution mandates the Testing Pyramid + 80% coverage.
- Commit after each task or each `[P]` group; never commit with the coverage gate failing.

## Task summary

- Total tasks: **64** (T001–T064).
- Phase 1 (Setup): 8 tasks.
- Phase 2 (Foundational): 18 tasks.
- Phase 3 (US1 — Register): 12 tasks (5 test, 7 impl).
- Phase 4 (US2 — Sign-in/Session): 12 tasks (5 test, 7 impl).
- Phase 5 (US3 — Password reset): 7 tasks (3 test, 4 impl).
- Phase 6 (Polish): 7 tasks.
- Parallel groups: 11 distinct `[P]` clusters across phases.
- Independent test entry points per story: T030/T031 (US1), T042/T043 (US2), T052/T053 (US3) → quickstart Journeys 1, 2, 3, 4.
- Suggested MVP: **US1 + US2** (P1 stories together).
