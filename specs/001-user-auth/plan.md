# Implementation Plan: User Authentication System

**Branch**: `001-user-auth` | **Date**: 2026-05-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-user-auth/spec.md`

## Summary

Deliver a backend authentication service that supports email/password
registration with mandatory email verification, password sign-in returning a
short-lived JWT session credential (24-hour expiry), password reset by email,
account lockout on brute force, and security notification emails. Implemented
as an Express.js HTTP service in TypeScript (strict mode), persisting accounts,
verification requests, password-reset requests, sessions, and audit events to
PostgreSQL. Passwords are hashed with bcrypt; session credentials are
stateless JWTs whose `jti` is stored server-side so individual sessions and
all-sessions-of-account revocations are enforceable. Tested with Jest under
the Testing Pyramid, with ≥ 80% coverage on business logic.

## Technical Context

**Language/Version**: TypeScript 5.4 on Node.js 20 LTS (active LTS through 2026-04 → 2026-04 maintenance)  
**Primary Dependencies**: Express.js 4.x, `pg` (node-postgres) with `pg-pool`, `bcrypt` 5.x, `jsonwebtoken` 9.x, `zod` (validation at boundaries), `pino` (structured logging), `nodemailer` 6.x with SMTP transport for the existing transactional email service, `helmet`, `express-rate-limit`, `cookie-parser`  
**Storage**: PostgreSQL 16 (single database); migrations via `node-pg-migrate`  
**Testing**: Jest 29 with `ts-jest`; `supertest` for HTTP integration tests; `testcontainers` for ephemeral PostgreSQL in integration tests; `nodemailer` `jsonTransport` (or a fake) in tests  
**Target Platform**: Linux containers (Node 20) behind TLS-terminating reverse proxy  
**Project Type**: Web service (backend-only; no frontend in this feature)  
**Performance Goals**: 95th-percentile latency < 300 ms for sign-in, < 200 ms for token validation, sustaining 200 req/s steady on a single instance  
**Constraints**: All endpoints over HTTPS; no plaintext credentials in logs; bcrypt cost factor tuned so a hash takes ~150–250 ms on target hardware; emails dispatched asynchronously so HTTP responses return < 500 ms even when SMTP is slow  
**Scale/Scope**: Tens of thousands of accounts at v1; single-region deployment; ≤ 10 endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Derived from `.specify/memory/constitution.md` v1.0.0.

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 1 | **I. Clean Code** — SRP per module, functions ≤ 30 LOC / complexity ≤ 10, no dead code, no TODO without issue | ✅ Pass | Layered structure (`routes` → `services` → `repositories`) keeps each module single-purpose; no shared mutable state. |
| 2 | **II. TypeScript strict** — `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `exactOptionalPropertyTypes`; no `any`/`!`/`@ts-ignore`; external data parsed (Zod) | ✅ Pass | `tsconfig.json` to be created with full strict family enabled; all HTTP inputs and DB rows pass through Zod parsers. |
| 3 | **III. Testing Pyramid + ≥ 80% coverage on business logic** — unit base, integration middle, E2E tip; CI-enforced threshold | ✅ Pass | Jest projects: `unit` (services, hashing, token, validators), `integration` (HTTP + Postgres via Testcontainers), `e2e` (small set of critical journeys). Coverage thresholds in `jest.config.ts` for `src/services/**` and `src/domain/**` set to 80% lines+branches. |
| 4 | **IV. JSDoc on all exported symbols** | ✅ Pass | ESLint with `eslint-plugin-jsdoc` enforces presence on all exports (functions, types, classes, constants); CI fails on missing JSDoc. |
| 5 | Quality & Tooling — ESLint + Prettier in CI, lockfile pinned, vulnerable dep triage | ✅ Pass | `eslint`, `@typescript-eslint`, `eslint-plugin-jsdoc`, `prettier` configured; `package-lock.json` committed; `npm audit` runs in CI. |
| 6 | Workflow — `tsc --noEmit`, lint, all test tiers, coverage threshold, JSDoc lint, code review | ✅ Pass | Single `npm run check` script chains `tsc --noEmit && eslint . && prettier --check . && jest --coverage`; CI runs same script. |

**Initial Constitution Check: PASS — proceed to Phase 0.**

## Project Structure

### Documentation (this feature)

```text
specs/001-user-auth/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI)
│   └── openapi.yaml
├── checklists/
│   └── requirements.md  # Created by /speckit.specify
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── app.ts                       # Express app factory (no listen)
│   ├── server.ts                    # Process bootstrap + graceful shutdown
│   ├── config/
│   │   └── env.ts                   # Zod-parsed env, single source of truth
│   ├── domain/                      # Pure business logic (no I/O) — covered ≥ 80%
│   │   ├── password-policy.ts
│   │   ├── token-claims.ts
│   │   └── errors.ts
│   ├── services/                    # Use-cases — covered ≥ 80%
│   │   ├── registration.service.ts
│   │   ├── verification.service.ts
│   │   ├── auth.service.ts          # sign-in, sign-out, lockout
│   │   ├── session.service.ts       # JWT issue/verify/revoke
│   │   ├── password-reset.service.ts
│   │   └── notification.service.ts  # security emails (deduped)
│   ├── repositories/                # Postgres access (parameterized SQL)
│   │   ├── user.repo.ts
│   │   ├── session.repo.ts
│   │   ├── verification.repo.ts
│   │   ├── reset.repo.ts
│   │   └── audit.repo.ts
│   ├── http/
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── account.routes.ts
│   │   │   └── reset.routes.ts
│   │   ├── middleware/
│   │   │   ├── authenticate.ts      # JWT + jti revocation check
│   │   │   ├── error-handler.ts
│   │   │   ├── rate-limit.ts
│   │   │   └── validate.ts          # Zod request validation
│   │   └── schemas/                 # Zod request/response schemas
│   ├── infra/
│   │   ├── db.ts                    # pg Pool factory
│   │   ├── mailer.ts                # nodemailer transport
│   │   ├── hasher.ts                # bcrypt wrapper
│   │   └── clock.ts                 # injectable time source
│   └── lib/
│       └── crypto.ts                # CSPRNG token generation
├── migrations/                      # node-pg-migrate SQL migrations
├── tests/
│   ├── unit/                        # Pure-function and service-level tests
│   ├── integration/                 # HTTP + Postgres (testcontainers)
│   └── e2e/                         # Critical journeys (≤ 5 cases)
├── jest.config.ts
├── tsconfig.json
├── .eslintrc.cjs
├── .prettierrc
└── package.json
```

**Structure Decision**: Single backend service (`backend/`) at repo root.
No frontend in this feature; HTTP contract published in `contracts/openapi.yaml`
so any future client (web, mobile, CLI) can consume it. The domain/services/
repositories split keeps business logic free of I/O so the 80% coverage gate
applies cleanly to `src/domain/**` and `src/services/**`.

## Complexity Tracking

No constitution violations; section intentionally empty.
