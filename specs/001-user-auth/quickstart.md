# Quickstart: User Authentication System

Bring up the service locally and exercise the four key user journeys.

## Prerequisites

- Node.js 20 LTS
- Docker (for the local PostgreSQL container)
- `npm` 10+

## 1. Install & configure

```powershell
cd backend
npm ci
Copy-Item .env.example .env  # then edit secrets
```

`.env` (minimum):

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://auth:auth@localhost:5432/auth
JWT_SECRET=change-me-32-bytes-minimum-base64
JWT_EXPIRES_IN=86400        # 24h, matches FR-007
BCRYPT_COST=12
SMTP_URL=smtp://localhost:1025  # MailHog for local dev
EMAIL_FROM=no-reply@example.com
RESET_TOKEN_TTL_SECONDS=3600    # 1h, matches FR-014
VERIFY_TOKEN_TTL_SECONDS=86400  # 24h, matches FR-005b
LOCKOUT_THRESHOLD=10
LOCKOUT_WINDOW_SECONDS=600
LOCKOUT_DURATION_SECONDS=900
```

## 2. Start dependencies

```powershell
docker run --rm -d --name auth-pg -p 5432:5432 `
  -e POSTGRES_USER=auth -e POSTGRES_PASSWORD=auth -e POSTGRES_DB=auth postgres:16
docker run --rm -d --name auth-mail -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

MailHog UI: <http://localhost:8025> (captures all outbound email).

## 3. Migrate & run

```powershell
npm run migrate:up
npm run dev          # tsx watch on src/server.ts
```

Service listens on `http://localhost:3000`.

## 4. Smoke-test the four journeys

Run from a second terminal. All `curl` commands assume `bash`-style; on
Windows substitute PowerShell `Invoke-RestMethod` if preferred.

### Journey 1 — Register (User Story 1)

```bash
curl -i -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"Pass1234"}'
# → HTTP/1.1 202 Accepted   { "status": "accepted" }
```

Open MailHog (<http://localhost:8025>), open the verification email, copy the
`token` query parameter from the link, then:

```bash
curl -i -X POST http://localhost:3000/auth/verify \
  -H 'Content-Type: application/json' \
  -d '{"token":"<paste-token-here>"}'
# → HTTP/1.1 204 No Content
```

### Journey 2 — Sign in & call a protected endpoint (User Story 2)

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"Pass1234"}' | jq -r .token)

curl -i http://localhost:3000/me -H "Authorization: Bearer $TOKEN"
# → HTTP/1.1 200 OK   { "id":"...", "email":"alice@example.com", ... }
```

Sign out:

```bash
curl -i -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer $TOKEN"
# → HTTP/1.1 204 No Content

curl -i http://localhost:3000/me -H "Authorization: Bearer $TOKEN"
# → HTTP/1.1 401 Unauthorized   (jti revoked — FR-008)
```

### Journey 3 — Password reset (User Story 3)

```bash
curl -i -X POST http://localhost:3000/auth/reset/request \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com"}'
# → HTTP/1.1 202 Accepted (identical for unknown emails — FR-013)
```

Open the reset email in MailHog, copy the `token` parameter, then:

```bash
curl -i -X POST http://localhost:3000/auth/reset/confirm \
  -H 'Content-Type: application/json' \
  -d '{"token":"<paste-token>","newPassword":"NewPass1234"}'
# → HTTP/1.1 204 No Content   (all prior sessions revoked — FR-015)
```

A "Your password was changed" notification email arrives in MailHog
(FR-016a).

### Journey 4 — Lockout (Edge Case)

Run 10 failed sign-ins:

```bash
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"alice@example.com","password":"wrong"}'
done
# → 401 401 401 401 401 401 401 401 401 423
```

The 11th attempt — even with the correct password — returns **423 Locked**
until 15 minutes elapse OR the user completes a password reset (FR-010b).
A "Your account was locked" notification email arrives in MailHog.

## 5. Run the test suite

```powershell
npm run check     # tsc --noEmit && eslint . && prettier --check . && jest --coverage
```

`npm run check` is the same script CI runs. It will fail if:

- TypeScript reports any error under strict mode.
- Any export is missing JSDoc (`eslint-plugin-jsdoc`).
- `src/domain/**` or `src/services/**` line/branch coverage drops below 80%
  (Constitution Principle III).

## 6. Tear down

```powershell
docker rm -f auth-pg auth-mail
```
