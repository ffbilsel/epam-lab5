# Implementation Plan: Local Dev Environment & Endpoint Test Coverage

**Feature Branch**: `002-dev-environment`
**Spec**: [spec.md](./spec.md)
**Status**: Approved
**Created**: 2026-05-09

## 1. Approach

Two thin, independent slices delivered together because they share the same
Postgres instance:

1. **Compose stack** for local dependencies (Postgres + MailHog) and an
   opt-in API container built from a multi-stage Dockerfile.
2. **Integration test project** that boots the existing Express app in-process
   via `buildApp()`, hits every auth endpoint with `supertest`, and asserts
   against an in-process JSON mailer.

No new runtime dependency on Docker is introduced; Compose is a contributor
convenience and a CI building block.

## 2. Component Choices & Rationale

| Concern | Choice | Why |
| --- | --- | --- |
| Database container | `postgres:16` official image | Matches the production target; ships `pgcrypto` and `citext` extensions used by 001's migration. |
| Schema application | Mount `./migrations` into `/docker-entrypoint-initdb.d` (read-only) | Postgres runs `*.sql` once on first init of the volume — zero extra tooling, no migration runner to configure. |
| Mail catcher | `mailhog/mailhog` | Single binary, exposes both SMTP (1025) and a web UI (8025); no auth required, perfect for dev. |
| API service | Defined in Compose under `profiles: ['app']` | Keeps the default `up` path fast (deps only) and avoids forcing an image rebuild on every code change. |
| Image build | Multi-stage `node:20-bookworm-slim`: build with devDeps, copy `dist/` into a deps-only runtime stage, `USER node` | Keeps runtime image small and non-root; mirrors what we'd publish later. |
| Test transport for mail | In-process `createJsonMailer()` swapped via `setMailer()` | Deterministic assertions on subject/body/recipient without touching MailHog. |
| Test isolation | `TRUNCATE … RESTART IDENTITY CASCADE` in `beforeEach`, `pool.end()` in `afterAll` | Fast, single-statement reset; no template DB needed. |
| Test compile | Separate `tsconfig.test.json` extending the prod `tsconfig.json` with `rootDir: '.'` and relaxed unused-locals rules | Production type-check stays strict; tests can sit outside `src/`. |

## 3. File Layout

```
backend/
  Dockerfile                    # multi-stage build
  .dockerignore                 # excludes node_modules, dist, tests, .env*
  docker-compose.yml            # postgres + mailhog (default), app (profile)
  tsconfig.test.json            # rootDir='.', extends tsconfig.json
  jest.config.cjs               # ts-jest now points at tsconfig.test.json
  src/config/env.ts             # add `import 'dotenv/config'` at top
  src/services/registration.service.ts     # lazy mailer resolution
  src/services/verification.service.ts     # lazy mailer resolution
  src/services/password-reset.service.ts   # lazy mailer + lazy notifications
  tests/integration/
    _setup.ts                    # setupTestEnv / resetDb / teardown / extractToken
    auth-register.test.ts        # register + verify
    auth-login.test.ts           # login + lockout + logout + /auth/me
    auth-reset.test.ts           # reset request + confirm + session revocation
    migrations.test.ts           # information_schema smoke test
```

## 4. Compose Topology

- **postgres** — image `postgres:16`, env `POSTGRES_USER/PASSWORD/DB=auth`,
  publishes `5432:5432`, mounts `./migrations:/docker-entrypoint-initdb.d:ro`,
  named volume `pgdata` for persistence, healthcheck `pg_isready`.
- **mailhog** — image `mailhog/mailhog`, publishes `1025:1025` (SMTP) and
  `8025:8025` (UI). No volume; messages are ephemeral.
- **app** (profile `app`) — built from `./Dockerfile`, depends on
  `postgres` (`condition: service_healthy`) and `mailhog`, env wires
  `DATABASE_URL=postgres://auth:auth@postgres:5432/auth` and
  `SMTP_URL=smtp://mailhog:1025`, publishes `3000:3000`.

## 5. Test Strategy

- **Project**: a third `jest` project (`integration`) with
  `testTimeout: 60_000` to absorb the lockout-window test.
- **Transport**: `setMailer(createJsonMailer())` in the suite-level fixture;
  individual tests clear `mailer.sent` in `beforeEach`.
- **Coverage**: Every public route from feature 001 — `register`, `verify`,
  `login`, `logout`, `me`, `reset/request`, `reset/confirm` — plus a
  `migrations` smoke test that asserts the five domain tables exist.
- **Spec traceability**: Tests carry FR labels in titles where they enforce
  a specific functional requirement (FR-005 non-enumeration, FR-008
  immediate logout, FR-009 generic auth failure, FR-010 lockout, FR-013
  unknown-email parity, FR-015 reset revokes prior sessions).

## 6. Risk & Mitigation

| Risk | Mitigation |
| --- | --- |
| `initdb.d` only runs on a fresh volume → contributors miss schema changes after a migration update. | Document `docker compose down -v` as the way to refresh schema; future feature can introduce a real migration runner. |
| Module-load eager mailer would silently swallow test assertions. | All three services resolve the mailer through a `resolveMailer()` closure that re-reads `getMailer()` at call time. |
| Integration tests share one DB → cross-test bleed. | `TRUNCATE … CASCADE` in `beforeEach`; `pool.end()` in `afterAll`. |
| `dotenv` import in `env.ts` could leak prod values into containers. | Container env wins because `dotenv/config` does not overwrite already-set variables. |

## 7. Out of Scope (re-affirmed)

- A migration runner (we rely on `initdb.d`).
- Per-test ephemeral databases.
- CI changes (existing CI only runs unit tests; integration tests stay
  local for this slice).
- Image publishing.

## 8. Acceptance Gate

- `docker compose up -d` brings up Postgres + MailHog; `\dt` shows five
  tables.
- `npm run typecheck` passes.
- `NODE_OPTIONS=--experimental-vm-modules npx jest --selectProjects unit`
  passes (21 tests).
- `NODE_OPTIONS=--experimental-vm-modules npx jest --selectProjects integration --no-coverage`
  passes (16 tests).
