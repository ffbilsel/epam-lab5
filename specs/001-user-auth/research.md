# Phase 0 Research: User Authentication System

All Technical Context items in `plan.md` resolved without remaining
`NEEDS CLARIFICATION` markers. The notes below capture the key decisions, why
they were taken, and what alternatives were rejected.

## 1. Session credential format — stateless JWT with server-side `jti` allow-list

- **Decision**: Issue HS256-signed JWTs with claims
  `{ sub, jti, iat, exp, ver }` where `exp = iat + 24h`. Persist a `sessions`
  row keyed by `jti` (not the token itself); validation requires both
  signature verification and `jti` present + not revoked + not expired.
- **Rationale**: Required by the user request ("JWT for tokens") and by the
  spec's hard requirements that sign-out invalidates immediately (FR-008) and
  that any password change invalidates *all* sessions for the account
  (FR-015). Pure stateless JWT cannot satisfy either; pure opaque tokens do
  not satisfy "JWT for tokens". The `jti` allow-list reconciles both.
- **Alternatives rejected**:
  - Pure stateless JWT with short TTL + refresh token: cannot meet 24-hour
    expiry exactly and adds a refresh flow not in scope.
  - Opaque random session IDs: violates the explicit JWT requirement.
  - JWT denylist: requires storing every revoked token until expiry, more
    expensive than the allow-list and equally stateful.

## 2. Token signing key — HS256 with rotated symmetric secret in env

- **Decision**: HS256 with a 256-bit secret loaded from `JWT_SECRET` (Zod-
  validated at boot). Key rotation supported by allowing a `JWT_SECRET_PREV`
  for verification only during a configurable overlap window.
- **Rationale**: Single-service architecture; no third party verifies tokens,
  so asymmetric keys add operational cost without benefit. Rotation path
  exists from day one to avoid a future migration.
- **Alternatives rejected**: RS256 (operationally heavier; not justified for
  v1 single service); EdDSA (same).

## 3. Password hashing — bcrypt cost factor 12

- **Decision**: `bcrypt` with cost factor 12; cost configurable via
  `BCRYPT_COST` env var with a documented floor of 10.
- **Rationale**: Cost 12 yields ~150–250 ms per hash on the target hardware,
  matching the constraint in plan.md and OWASP 2024 password-storage
  guidance. Required by the user request.
- **Alternatives rejected**: `argon2id` (not requested, and bcrypt at cost
  12 is acceptable per OWASP); `scrypt` (same reason).

## 4. Email transport — `nodemailer` SMTP via existing transactional service

- **Decision**: `nodemailer` with SMTP transport pointed at the existing
  transactional email service (Assumption in spec). Email sending is
  enqueued and sent asynchronously so HTTP latency is not coupled to SMTP
  latency. In tests, swap to `jsonTransport`.
- **Rationale**: Spec assumes an existing transactional email service; SMTP
  is the lowest-common-denominator interface. Async dispatch satisfies the
  < 500 ms HTTP constraint even on slow SMTP responses.
- **Alternatives rejected**: Provider SDK (locks the project to one vendor);
  in-process synchronous send (couples HTTP latency to SMTP).

## 5. Persistence access — hand-written SQL with `pg`, no ORM

- **Decision**: Use `pg` (`node-postgres`) with a thin repository layer of
  parameterized SQL strings. Use `node-pg-migrate` for schema migrations.
- **Rationale**: Schema is small (5 tables), queries are straightforward, and
  hand-written SQL keeps the type boundary explicit (Zod parses each row),
  satisfying the constitution's "no `any`, parse external data" rule. Avoids
  the abstraction tax of an ORM for a small surface.
- **Alternatives rejected**: Prisma (extra build step + generated types
  duplicate the Zod boundary); TypeORM/Sequelize (heavier, weaker types).

## 6. Token & one-time-secret generation — Node `crypto.randomBytes(32)`, base64url

- **Decision**: Email verification tokens and password reset tokens are
  generated as 32 random bytes encoded as base64url. Stored in DB as a
  SHA-256 hash so a DB read does not yield usable tokens.
- **Rationale**: 256 bits of entropy is well beyond brute-forceable; hashing
  at rest is standard practice for one-time-use secrets, mirroring how
  passwords are protected.
- **Alternatives rejected**: Random UUID v4 (only ~122 bits); storing raw
  tokens (DB compromise yields working links).

## 7. Brute-force lockout — DB-backed counter with sliding 10-minute window

- **Decision**: Track `failed_attempts` and `last_failed_at` on the user row.
  On each failed sign-in, if the previous failure was within 10 minutes,
  increment; otherwise reset to 1. On reaching 10, set
  `locked_until = now + 15m` and emit `account.lockout` audit + notification.
  On successful sign-in or successful password reset, clear both counters and
  `locked_until`.
- **Rationale**: Satisfies FR-010, FR-010a, FR-010b, SC-007 with no extra
  infrastructure. Sliding window avoids lockouts driven by old, stale
  failures.
- **Alternatives rejected**: Redis-backed counter (operational cost not
  justified at v1 scale); IP-based lockout (penalises NAT'd users).

## 8. Rate limiting — `express-rate-limit` with per-route policies

- **Decision**: Apply per-IP+per-account limits to `/auth/login`,
  `/auth/register`, `/auth/verify/resend`, `/auth/reset/request`, and
  `/auth/reset/confirm`. Limits are conservative defaults, env-tunable.
- **Rationale**: Defence-in-depth alongside the account lockout; protects
  email-sending endpoints from abuse (FR-005c, FR-013).
- **Alternatives rejected**: Custom limiter (NIH); reverse-proxy-only
  limits (couples auth correctness to deployment topology).

## 9. Configuration & secrets — Zod-validated env at boot

- **Decision**: All configuration loaded from environment variables, parsed
  by a single Zod schema in `src/config/env.ts` at startup. Process exits on
  invalid config.
- **Rationale**: Constitution requires external data be parsed at the type
  boundary; env vars are external. Fail-fast prevents partially-initialised
  servers.
- **Alternatives rejected**: `dotenv-only` (no validation); JSON config files
  (no operator advantage at v1).

## 10. Test layering & coverage tooling — Jest projects + Testcontainers

- **Decision**: Jest configured with three projects:
  - `unit`: pure-function and service-level tests using in-memory fakes for
    repositories, mailer, clock, hasher.
  - `integration`: spins up a PostgreSQL container per worker via
    `testcontainers`; runs migrations; exercises HTTP via `supertest`.
  - `e2e`: a small set (≤ 5) of end-to-end happy/critical-failure paths.

  Coverage thresholds are configured per-path in `jest.config.ts`:

  ```ts
  coverageThreshold: {
    'src/domain/**':   { lines: 80, branches: 80, functions: 80, statements: 80 },
    'src/services/**': { lines: 80, branches: 80, functions: 80, statements: 80 },
  }
  ```

  Pure infrastructure (`src/infra/**`, `src/server.ts`) is excluded from the
  threshold via `coveragePathIgnorePatterns` and documented in plan.md.
- **Rationale**: Directly satisfies Constitution Principle III: pyramid
  shape, business-logic coverage floor enforced by config, infra exempt but
  explicit.
- **Alternatives rejected**: Single global 80% threshold (penalises
  legitimate infra glue); Vitest (Jest was explicitly requested).
