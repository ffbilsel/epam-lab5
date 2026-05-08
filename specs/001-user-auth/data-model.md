# Phase 1 Data Model: User Authentication System

PostgreSQL 16. All `id` columns are `uuid` (default `gen_random_uuid()` from
the `pgcrypto` extension). All timestamps are `timestamptz` and stored in
UTC. All token-like values (`token_hash`) are SHA-256 hex digests of the
random base64url secret given to the user; raw tokens are never stored.

## Entity overview

| Entity | Table | Spec FR mapping |
|---|---|---|
| User Account | `users` | FR-001..FR-005, FR-006, FR-009, FR-010, FR-010a, FR-010b, FR-016, FR-016a |
| Email Verification Request | `email_verifications` | FR-005a, FR-005b, FR-005c |
| Session | `sessions` | FR-007, FR-008, FR-015 |
| Password Reset Request | `password_resets` | FR-011..FR-015 |
| Security Audit Event | `audit_events` | FR-016 |

## `users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | Stable account identifier (`sub` in JWTs). |
| `email` | `citext` | NOT NULL, UNIQUE | Case-insensitive uniqueness via `citext` extension. |
| `password_hash` | `text` | NOT NULL | bcrypt hash; cost embedded in the value. |
| `email_verified_at` | `timestamptz` | NULL | NULL = unverified. Sign-in refused while NULL (FR-006). |
| `failed_attempts` | `int` | NOT NULL DEFAULT 0 | Sliding 10-min window counter. |
| `last_failed_at` | `timestamptz` | NULL | Used to reset the sliding window. |
| `locked_until` | `timestamptz` | NULL | If > now(), account is locked (FR-010a). |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() | |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT now() | Touched on any mutation. |

**Indexes**: implicit on `(id)`, `(email)`. Partial index
`(locked_until) WHERE locked_until IS NOT NULL` for the unlock sweeper.

**State transitions** (account-level):

```
unverified ──verify──▶ active ──lockout──▶ locked ──(locked_until elapses
                                                     OR password reset)──▶ active
```

**Validation rules (enforced in domain layer)**:

- `email` MUST match RFC 5322 (Zod `string().email()`).
- `password_hash` is the only persisted form of the password; raw passwords
  MUST never appear in any column or log line.
- Password policy (default): min 8 chars, ≥ 1 letter, ≥ 1 digit. Enforced
  on registration (FR-003) and on reset-confirm.

## `email_verifications`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | NOT NULL, FK → `users.id` ON DELETE CASCADE | |
| `token_hash` | `text` | NOT NULL, UNIQUE | SHA-256 of the issued token. |
| `issued_at` | `timestamptz` | NOT NULL DEFAULT now() | |
| `expires_at` | `timestamptz` | NOT NULL | `issued_at + 24h` by default. |
| `consumed_at` | `timestamptz` | NULL | Set on successful verification. |

**Indexes**: `(user_id) WHERE consumed_at IS NULL` to find live tokens for
"resend verification email" requests.

**Lifecycle**:

- Issued on registration (FR-005a) and on resend (FR-005c).
- On successful verification: set `users.email_verified_at = now()`,
  `consumed_at = now()`, and invalidate all other unconsumed rows for the
  same `user_id` (FR-005c says new link invalidates prior unused links;
  symmetrically a successful consume invalidates outstanding ones).
- A row is **valid** iff `consumed_at IS NULL AND expires_at > now()`.

## `sessions`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `jti` | `uuid` | PK | Mirrors the JWT `jti` claim. |
| `user_id` | `uuid` | NOT NULL, FK → `users.id` ON DELETE CASCADE | |
| `issued_at` | `timestamptz` | NOT NULL DEFAULT now() | Mirrors `iat`. |
| `expires_at` | `timestamptz` | NOT NULL | `issued_at + 24h`; mirrors `exp`. |
| `revoked_at` | `timestamptz` | NULL | Set on sign-out, password change, and lockout. |

**Indexes**: `(user_id) WHERE revoked_at IS NULL` for the revoke-all-sessions
operation.

**Validation at request time**: a JWT is accepted iff signature verifies AND
a `sessions` row exists with the same `jti` AND `revoked_at IS NULL` AND
`expires_at > now()`.

**Triggered transitions**:

- Sign-out (FR-008): `revoked_at = now()` for the current `jti`.
- Successful password change via reset or otherwise (FR-015): UPDATE all
  rows for the `user_id` with `revoked_at IS NULL` to `revoked_at = now()`.
- Lockout (FR-010a, defence in depth): same as above.

## `password_resets`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | NOT NULL, FK → `users.id` ON DELETE CASCADE | |
| `token_hash` | `text` | NOT NULL, UNIQUE | SHA-256 of the issued token. |
| `issued_at` | `timestamptz` | NOT NULL DEFAULT now() | |
| `expires_at` | `timestamptz` | NOT NULL | `issued_at + 1h` by default. |
| `consumed_at` | `timestamptz` | NULL | Set on successful reset. |

**Lifecycle**:

- Issued on `/auth/reset/request` for known emails only (but the API
  response is identical for unknown emails — FR-013).
- A row is **valid** iff `consumed_at IS NULL AND expires_at > now()`.
- On successful reset: `consumed_at = now()`, update `users.password_hash`,
  clear lockout fields, revoke all live sessions, send notification email.

## `audit_events`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `bigserial` | PK | |
| `user_id` | `uuid` | NULL, FK → `users.id` ON DELETE SET NULL | NULL when the action targets an unknown email (e.g. reset request for unknown). |
| `event_type` | `text` | NOT NULL, CHECK in enum below | |
| `outcome` | `text` | NOT NULL, CHECK in (`success`, `failure`) | |
| `occurred_at` | `timestamptz` | NOT NULL DEFAULT now() | |
| `metadata` | `jsonb` | NOT NULL DEFAULT `'{}'::jsonb` | Non-sensitive context (e.g. IP hash, user agent class). NEVER contains credentials or full IPs. |

**Allowed `event_type` values**:
`registration`, `email_verification_sent`, `email_verification_completed`,
`signin`, `signout`, `reset_request`, `reset_completed`, `password_changed`,
`account_lockout`, `lockout_cleared`.

**Indexes**: `(user_id, occurred_at DESC)`, `(event_type, occurred_at DESC)`.

## Cross-entity invariants

1. **No plaintext credentials** anywhere: enforced by repository layer (no
   column accepts a raw password or raw token); enforced by log filter
   middleware on the request body.
2. **Token uniqueness across types is not required** (each table has its
   own `token_hash` UNIQUE), but the `/auth/verify` and `/auth/reset/confirm`
   endpoints look up only their own table, eliminating cross-confusion.
3. **Time source is injected** (`Clock`) across services so tests can
   deterministically advance time for expiry assertions (SC-003).
4. **Soft-delete is not used in v1** — account deletion is out of scope
   (spec Assumptions). FK `ON DELETE CASCADE` is therefore safe.

## Migrations (initial)

Single migration `001_init_auth.sql`:

1. `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
2. `CREATE EXTENSION IF NOT EXISTS citext;`
3. Create tables in order: `users`, `email_verifications`, `sessions`,
   `password_resets`, `audit_events`.
4. Create the indexes listed above.
