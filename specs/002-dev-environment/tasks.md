# Tasks: Local Dev Environment & Endpoint Test Coverage

**Feature Branch**: `002-dev-environment`
**Plan**: [plan.md](./plan.md)

Tasks are grouped by phase. `[X]` = done. Phases run top-to-bottom; tasks
within a phase marked `[P]` may run in parallel.

## Phase 1 — Compose & Image (US1, US2)

- [X] T001 [P] Author `backend/docker-compose.yml` with `postgres` + `mailhog`
  services, named `pgdata` volume, healthcheck on Postgres, and read-only
  bind mount `./migrations → /docker-entrypoint-initdb.d`. (FR-001/2/3)
- [X] T002 [P] Add an `app` service to the same Compose file, gated by
  `profiles: ['app']`, depending on `postgres` (service_healthy) and
  `mailhog`, with `DATABASE_URL` and `SMTP_URL` wired to in-network DNS
  names. (FR-004)
- [X] T003 [P] Author `backend/Dockerfile` as a multi-stage build:
  builder stage compiles TypeScript, runtime stage installs prod deps,
  copies `dist/`, drops to `USER node`, and runs `node dist/server.js`.
  (FR-005)
- [X] T004 [P] Author `backend/.dockerignore` excluding `node_modules`,
  `dist`, `coverage`, `.env*`, `.git`, `*.log`, `tests`, lint/format/test
  configs, and `README.md`. (FR-006)
- [X] T005 Verify the deps-only stack: `docker compose up -d postgres mailhog`,
  then `docker exec auth-pg psql -U auth -d auth -c '\dt'` lists the five
  tables. (SC-001)

## Phase 2 — Service & Config Adjustments

- [X] T006 In `src/config/env.ts`, add `import 'dotenv/config'` at the top so
  `npm run dev` and `npm test` both pick up `backend/.env`. (FR-012)
- [X] T007 Add `dotenv` to `backend/package.json` dependencies and refresh
  `package-lock.json`.
- [X] T008 In `src/services/registration.service.ts`, replace the
  module-load `mailer = deps.mailer ?? getMailer()` with a
  `resolveMailer()` closure invoked at send time. (FR-011)
- [X] T009 [P] Same change in `src/services/verification.service.ts`. (FR-011)
- [X] T010 [P] Same change in `src/services/password-reset.service.ts`,
  including a `resolveNotifications()` closure for the notification service
  it composes. (FR-011)

## Phase 3 — Test Toolchain

- [X] T011 Add `backend/tsconfig.test.json` extending `tsconfig.json` with
  `rootDir: '.'`, `noUnusedLocals: false`, `noUnusedParameters: false`,
  and `include: ['src/**/*.ts', 'tests/**/*.ts']`. (FR-013)
- [X] T012 Point ts-jest at the new test tsconfig in `jest.config.cjs`
  (`tsconfig: '<rootDir>/tsconfig.test.json'`). (FR-013)

## Phase 4 — Integration Fixtures (US3)

- [X] T013 Create `backend/tests/integration/_setup.ts` exporting
  `setupTestEnv()` (installs `createJsonMailer()` and returns
  `{ app, mailer }`), `resetDb()` (TRUNCATE … RESTART IDENTITY CASCADE on
  the five domain tables), `teardown()` (`pool.end()`), and
  `extractToken(body)` (regex `/token:\s*([A-Za-z0-9_-]+)/`). (FR-009/10/11)

## Phase 5 — Endpoint Suites (US3)

- [X] T014 [P] `tests/integration/auth-register.test.ts` — register dispatches
  one verification email; duplicate email returns identical 202 with no
  second email (FR-005); weak password → 400 problem+json; verify with
  emailed token → 204; bogus token → 410. (FR-007/8/9, SC-002/4)
- [X] T015 [P] `tests/integration/auth-login.test.ts` — happy path returns
  token + expiresAt; wrong password → 401 (FR-009); unverified account →
  401 with `code: 'email_not_verified'`; ≤11 wrong attempts trip the
  423 lockout (FR-010); logout invalidates the JWT against `/auth/me`
  (FR-008); missing bearer → 401. (FR-007/8, SC-002/4)
- [X] T016 [P] `tests/integration/auth-reset.test.ts` — reset request for a
  known email sends one reset email; known vs unknown email return
  byte-identical 202 bodies (FR-013); confirming a reset revokes the prior
  session and the new password works (FR-015); invalid reset token → 410.
  (FR-007/8/9, SC-002/4)
- [X] T017 [P] `tests/integration/migrations.test.ts` — query
  `information_schema.tables` and assert the five domain tables exist.
  (FR-007)

## Phase 6 — Verification

- [X] T018 `npm run typecheck` passes against `tsconfig.json` (prod rules).
- [X] T019 `NODE_OPTIONS=--experimental-vm-modules npx jest --selectProjects unit --no-coverage` → 21/21 pass.
- [X] T020 `NODE_OPTIONS=--experimental-vm-modules npx jest --selectProjects integration --no-coverage` → 16/16 pass against the Compose Postgres. (SC-002/3/4)

## Phase 7 — Wrap-Up

- [X] T021 Commit on `002-dev-environment` with a message that lists each
  artifact and the verification numbers (`21 unit + 16 integration`).
- [X] T022 Push `002-dev-environment` to `origin`.
