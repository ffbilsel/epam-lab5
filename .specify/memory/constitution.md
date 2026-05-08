<!--
SYNC IMPACT REPORT
==================
Version change: [unversioned template] → 1.0.0 (initial ratification)
Bump rationale: First concrete adoption of the constitution; establishes
foundational principles. Initial release uses MAJOR=1.

Modified principles:
  - [PRINCIPLE_1_NAME] → I. Clean Code (NON-NEGOTIABLE)
  - [PRINCIPLE_2_NAME] → II. TypeScript with Strict Mode
  - [PRINCIPLE_3_NAME] → III. Testing Pyramid with 80% Business-Logic Coverage
  - [PRINCIPLE_4_NAME] → IV. JSDoc Documentation for All Code
  - [PRINCIPLE_5_NAME] → REMOVED (only four principles requested)

Added sections:
  - Core Principles (I–IV)
  - Quality & Tooling Standards
  - Development Workflow & Quality Gates
  - Governance

Removed sections:
  - Fifth principle slot (template placeholder)

Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (Constitution Check section is generic;
       gates derived from this file at plan time — no edits required)
  - ✅ .specify/templates/spec-template.md (no constitution-specific references)
  - ✅ .specify/templates/tasks-template.md (no constitution-specific references)
  - ✅ .github/prompts/*.prompt.md (no outdated references)
  - ⚠ README.md / docs/quickstart.md — not present in repository; create if/when
       runtime guidance docs are added.

Deferred / Follow-up TODOs:
  - None.
-->

# SpecKit Lab Constitution

## Core Principles

### I. Clean Code (NON-NEGOTIABLE)

All production code MUST adhere to clean code practices:

- Names MUST reveal intent; abbreviations and single-letter identifiers are
  prohibited outside of conventional loop indices and well-known math symbols.
- Functions MUST do one thing, stay small (target ≤ 30 logical lines), and
  keep cyclomatic complexity ≤ 10. Functions exceeding these limits MUST be
  refactored or explicitly justified in code review.
- Modules MUST follow the Single Responsibility Principle; cross-cutting
  concerns MUST be isolated behind explicit interfaces.
- Dead code, commented-out code, and TODOs without an issue link are
  prohibited in `main`.
- Duplication MUST be removed (DRY) once the same logic appears a third time;
  premature abstraction is equally discouraged (YAGNI).

**Rationale**: Readability and maintainability dominate the total cost of
software. Enforcing clean code at the principle level prevents accumulation
of structural debt that later blocks delivery.

### II. TypeScript with Strict Mode

All source code MUST be written in TypeScript with the strict compiler family
enabled. The repository's `tsconfig.json` MUST set, at minimum:

- `"strict": true` (enables `strictNullChecks`, `noImplicitAny`,
  `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`,
  `alwaysStrict`, `useUnknownInCatchVariables`).
- `"noUncheckedIndexedAccess": true`
- `"noImplicitOverride": true`
- `"noFallthroughCasesInSwitch": true`
- `"exactOptionalPropertyTypes": true`

Use of `any`, non-null assertions (`!`), and `@ts-ignore` is prohibited;
`@ts-expect-error` MAY be used only with an inline justification comment and
a linked issue. External/untyped data MUST cross the type boundary through a
validated parser (e.g., Zod) — not casts.

**Rationale**: Strict typing eliminates entire classes of runtime defects at
build time and makes refactors safe, which is foundational to the other
principles.

### III. Testing Pyramid with 80% Business-Logic Coverage

Automated testing MUST follow the testing pyramid:

- **Unit tests** form the base: fast, isolated, no I/O, no network. They MUST
  cover all business logic (domain services, pure functions, reducers,
  use-cases) with **≥ 80% line and branch coverage**. Coverage MUST be
  measured and enforced in CI; PRs that drop business-logic coverage below
  the threshold MUST fail.
- **Integration tests** form the middle layer: verify contracts between
  modules, database access, and external adapters using realistic fakes or
  test containers. Coverage threshold for adapters: meaningful per-contract
  tests; no numeric percentage required.
- **End-to-end tests** form the tip: cover critical user journeys only. They
  MUST remain a small minority of total test count.

The 80% threshold applies to business-logic packages/modules; pure
infrastructure glue and generated code are exempt but MUST be excluded
explicitly via coverage configuration.

**Rationale**: The pyramid keeps the test suite fast and reliable while the
coverage floor on business logic guards the highest-value code paths against
regressions.

### IV. JSDoc Documentation for All Code

Every exported symbol — functions, classes, methods, types, interfaces,
enums, and module-level constants — MUST carry a JSDoc block that includes:

- A one-sentence summary describing intent (not restating the signature).
- `@param` for every parameter with type-meaningful description.
- `@returns` for non-void functions.
- `@throws` for any error type a caller is expected to handle.
- `@example` for any public API surface or non-obvious utility.

Internal (non-exported) symbols MUST be documented when their purpose is not
self-evident from the name and signature. Documentation MUST be kept in sync
with code; stale JSDoc is treated as a defect. Linting MUST enforce JSDoc
presence on exported symbols (e.g., `eslint-plugin-jsdoc`).

**Rationale**: Inline contract documentation accelerates onboarding, makes
generated API docs trustworthy, and complements TypeScript types with
behavioural intent.

## Quality & Tooling Standards

- **Language & runtime**: TypeScript only for application code. Build
  toolchain MUST type-check on every commit and in CI.
- **Linting & formatting**: ESLint (with `@typescript-eslint` and
  `eslint-plugin-jsdoc`) and Prettier MUST run in CI; warnings MUST be
  treated as errors on protected branches.
- **Coverage tooling**: A coverage reporter (e.g., `c8`, `vitest --coverage`,
  or `jest --coverage`) MUST emit machine-readable reports and enforce the
  80% business-logic threshold via configuration, not honour system.
- **Dependency hygiene**: Direct dependencies MUST be pinned via lockfile;
  transitive vulnerabilities MUST be triaged within one sprint of disclosure.

## Development Workflow & Quality Gates

The following gates MUST pass before a change merges to `main`:

1. `tsc --noEmit` succeeds with the strict configuration above.
2. ESLint and Prettier produce zero errors.
3. Unit, integration, and E2E test suites pass.
4. Business-logic coverage ≥ 80% (line and branch).
5. JSDoc lint rule passes on all exported symbols.
6. Code review by at least one other contributor; reviewers MUST verify
   compliance with each Core Principle and reject changes that bypass them
   without an approved justification recorded in the PR description.
7. Constitution Check in the planning template (see
   `.specify/templates/plan-template.md`) is satisfied or contains a
   documented complexity justification.

## Governance

This constitution supersedes ad-hoc conventions and individual preferences.
Conflicts between this document and other guidance MUST be resolved in favour
of this constitution unless an amendment is ratified.

**Amendment procedure**:

1. Open a PR modifying `.specify/memory/constitution.md` with the proposed
   change and a Sync Impact Report.
2. The PR MUST update the version number per the policy below and propagate
   changes to dependent templates and docs in the same PR.
3. At least one maintainer review is required; principle removals or
   redefinitions require maintainer consensus.

**Versioning policy** (semantic):

- **MAJOR**: Backward-incompatible governance or principle removals /
  redefinitions.
- **MINOR**: New principle or section added, or existing guidance materially
  expanded.
- **PATCH**: Clarifications, wording, typos, non-semantic refinements.

**Compliance review**: Every PR description MUST include a brief
"Constitution compliance" note. Periodic audits (at least once per release)
MUST verify that the codebase still satisfies the principles; deviations MUST
be filed as remediation issues.

**Version**: 1.0.0 | **Ratified**: 2026-05-08 | **Last Amended**: 2026-05-08
