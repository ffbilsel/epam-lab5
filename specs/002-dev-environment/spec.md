# Feature Specification: Local Dev Environment & Endpoint Test Coverage

**Feature Branch**: `002-dev-environment`
**Created**: 2026-05-09
**Status**: Draft
**Input**: User description: "using speckit for dev environment prepare a docker compose file and add automated endpoint tests"

## Clarifications

### Session 2026-05-09

- Q: Should the API container be started by default with the rest of the stack? → A: No — only the dependencies (Postgres, mail catcher) start by default; the API is opt-in via a Compose profile so contributors can keep running it from `npm run dev` while the deps run in containers.
- Q: How should the database schema be applied inside the container? → A: Mount the existing `migrations/` directory into Postgres' `/docker-entrypoint-initdb.d` so the schema is applied automatically on first volume bootstrap; no separate migration runner is needed for v1.
- Q: How should email be handled in the dev stack? → A: Run MailHog in the stack so the SMTP path is exercised end-to-end and developers can inspect outgoing email in a browser, while integration tests use an in-process JSON mailer to keep assertions deterministic.
- Q: What is the minimum endpoint coverage that must be automated? → A: Every public auth endpoint (`/auth/register`, `/auth/verify`, `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/reset/request`, `/auth/reset/confirm`) plus a migrations smoke test, all running against a real Postgres in CI/local.
- Q: Should the integration suite share the dev Postgres or use a throwaway one? → A: Share the dev Postgres for now; tests truncate every domain table before each test so suites are isolated and can run repeatedly without re-seeding.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-Command Local Stack (Priority: P1)

A backend contributor clones the repo and brings up Postgres and a mail catcher
with a single command, with the schema already applied, so they can start
working on the auth API immediately.

**Why this priority**: Onboarding friction is the largest source of lost time
on this codebase today (manual Postgres install, manual schema apply, ad-hoc
SMTP). Removing it unblocks everyone.

**Independent Test**: Fresh clone → `docker compose up -d` → `psql` (or `\dt`)
shows the five domain tables → MailHog UI is reachable on its published port.
No application code or test framework is required to validate this story.

**Acceptance Scenarios**:

1. **Given** a fresh clone with Docker installed, **When** the contributor runs
   the documented bring-up command, **Then** a Postgres 16 container and a
   MailHog container are running and healthy within reasonable time.
2. **Given** a freshly bootstrapped Postgres volume, **When** Postgres finishes
   starting, **Then** the auth schema (users, email_verifications, sessions,
   password_resets, audit_events) is already present without any extra command.
3. **Given** the stack is up, **When** the contributor stops it and brings it
   back up, **Then** previously stored data is still present (volume persists)
   and no migration replay is attempted.
4. **Given** the API is running locally against the containerized Postgres,
   **When** a registration triggers an email, **Then** the email is visible in
   the MailHog web UI.

---

### User Story 2 - Containerized API for Parity Checks (Priority: P2)

A contributor optionally runs the API itself in a container that mirrors what
CI/production would build, so they can validate the Dockerfile and the
container-to-container networking without polluting the default workflow.

**Why this priority**: Useful for catching environment drift, but not required
for day-to-day development — so it must be opt-in and must not slow the default
`docker compose up` path.

**Independent Test**: `docker compose --profile app up --build` brings the
image up; `curl http://localhost:3000/healthz` returns 200; image is built
from the multi-stage `Dockerfile` and runs as a non-root user.

**Acceptance Scenarios**:

1. **Given** the default bring-up command, **When** it completes, **Then** the
   API container is NOT started (only deps).
2. **Given** the `app` profile is selected, **When** the stack starts, **Then**
   the API image is built from the local Dockerfile, runs as a non-root user,
   and reaches a healthy state.
3. **Given** the API container is running, **When** it talks to Postgres and
   MailHog, **Then** it uses in-network DNS names (`postgres`, `mailhog`) and
   the contributor's host port mappings still work for direct access.

---

### User Story 3 - Automated Endpoint Coverage (Priority: P1)

Every public auth endpoint has an automated test that exercises the real
HTTP layer against a real Postgres, so regressions surface before they reach
review.

**Why this priority**: Unit tests alone cannot catch wiring bugs in the
Express routes, middleware order, mailer dispatch, or SQL. Endpoint tests are
the smallest meaningful safety net for an auth service.

**Independent Test**: Run the integration project of the test runner; the
suite spins up the Express app in-process, hits every documented endpoint,
and reports pass/fail without any manual setup beyond `docker compose up -d`.

**Acceptance Scenarios**:

1. **Given** a clean database, **When** the integration suite runs, **Then**
   it exercises register, verify, login, logout, `/auth/me`, reset request,
   and reset confirm at minimum, plus a migrations presence check.
2. **Given** the suite asserts on outgoing email, **When** a test triggers an
   email-sending action, **Then** the suite captures the email through an
   in-process JSON mailer (not MailHog) so assertions are deterministic.
3. **Given** two integration test files, **When** they run in sequence,
   **Then** the second file starts from a clean database state without
   manual intervention.
4. **Given** non-enumeration requirements (FR-005, FR-013) and lockout
   (FR-010) and session-revocation-on-reset (FR-015) from feature 001,
   **When** the integration suite runs, **Then** each of those behaviours is
   covered by at least one assertion.

---

### Edge Cases

- The Postgres `initdb` mount only runs on a fresh volume — schema changes
  during this feature must therefore happen by destroying and recreating the
  volume; this is acceptable for a v1 dev stack but must be called out.
- Contributors may already have Postgres listening on `5432`; the documented
  bring-up command should fail fast with a clear port-conflict message rather
  than silently colliding.
- Integration tests must not leave the connection pool open or the test
  runner will hang; teardown must close the pool exactly once per worker.
- Mailer wiring is module-load eager in some services; tests must be able to
  swap the transport after module load, otherwise the JSON mailer captures
  nothing and email assertions silently pass with empty arrays.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST provide a single Compose definition that
  brings up Postgres 16 and a SMTP catcher with one command.
- **FR-002**: The Compose definition MUST auto-apply the existing SQL
  migrations on first volume bootstrap, with no extra command.
- **FR-003**: The Compose definition MUST expose Postgres on a host port and
  the mail catcher's web UI on a host port for direct inspection.
- **FR-004**: The API service MUST be defined in Compose but gated behind an
  opt-in profile, so the default bring-up does not build or start it.
- **FR-005**: The repository MUST provide a multi-stage Dockerfile that
  builds with dev dependencies and ships a runtime-only image running as a
  non-root user.
- **FR-006**: A `.dockerignore` MUST exclude `node_modules`, build output,
  test artifacts, local environment files, and VCS data from the build
  context.
- **FR-007**: The integration test project MUST cover every public auth
  endpoint listed in feature 001 plus a migrations smoke test.
- **FR-008**: The integration tests MUST run against a real Postgres
  reachable via the standard environment configuration; they MUST NOT use an
  in-memory or mocked database.
- **FR-009**: The integration tests MUST use an in-process mailer that
  records outgoing messages, so email assertions are deterministic and do
  not depend on MailHog.
- **FR-010**: The integration suite MUST truncate all domain tables before
  each test and MUST close the database pool at suite teardown.
- **FR-011**: Service code MUST resolve the mailer lazily at call time so
  tests can swap the transport after module load.
- **FR-012**: The configuration loader MUST automatically read the
  repository-local environment file when present, so the same code path
  works in `npm run dev`, `npm test`, and the runtime container.
- **FR-013**: The test toolchain MUST compile test files that live outside
  the production source root without weakening production type-check rules.

### Key Entities *(include if feature involves data)*

- **Compose Stack**: Logical grouping of `postgres`, `mailhog`, and the
  optional `app` service; owns the network and named volume for Postgres
  data.
- **API Image**: The artifact produced by the multi-stage Dockerfile;
  consumed by the optional `app` service and (in the future) by CI.
- **Integration Fixture**: Shared helper that builds the Express app with
  the JSON mailer installed and offers truncate/teardown utilities.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A contributor with Docker installed can go from `git clone` to
  a usable Postgres with the schema applied in under 5 minutes, using only
  documented commands.
- **SC-002**: Every public auth endpoint has at least one automated assertion
  that runs against a real Postgres and exits non-zero on regression.
- **SC-003**: The integration suite completes in under 60 seconds on the
  reference machine and passes 100% of the time on a clean DB.
- **SC-004**: Removing or breaking any auth route surfaces as a failing
  integration test, not as a runtime error in production.
- **SC-005**: The runtime container image runs as a non-root user and does
  not include dev dependencies.

## Assumptions

- Docker (with the Compose plugin) is available on contributor machines.
- Host ports `5432`, `1025`, `8025`, and `3000` are free or contributors will
  remap them locally.
- The auth feature (001) is already merged in source form; this feature only
  adds tooling and tests around it.
- A throwaway dedicated test database is out of scope for v1; the dev
  Postgres is shared and isolated by per-test truncation.
- Production deployment, image registry publishing, and Kubernetes manifests
  are out of scope.

## Out of Scope

- Per-test ephemeral databases or template-database cloning.
- Publishing the Docker image to a registry.
- Running the integration tests inside Docker (they run on the host against
  the containerized Postgres).
- Production-grade SMTP configuration (MailHog is dev-only).
