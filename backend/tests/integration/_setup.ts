/**
 * Test fixtures: build the app with a JSON-transport mailer that records emails,
 * and a helper to wipe DB tables between tests.
 */
import 'dotenv/config';
import { buildApp } from '../../src/app.js';
import {
  setMailer,
  createJsonMailer,
  type Mailer,
  type OutgoingEmail,
} from '../../src/infra/mailer.js';
import { pool } from '../../src/infra/db.js';

export interface TestEnv {
  app: ReturnType<typeof buildApp>;
  mailer: Mailer & { readonly sent: OutgoingEmail[] };
}

/** Build the test environment (call once per suite). */
export function setupTestEnv(): TestEnv {
  const mailer = createJsonMailer();
  setMailer(mailer);
  const app = buildApp();
  return { app, mailer };
}

/** Truncate every domain table — call in beforeEach. */
export async function resetDb(): Promise<void> {
  await pool.query(
    'TRUNCATE audit_events, password_resets, sessions, email_verifications, users RESTART IDENTITY CASCADE',
  );
}

/** Close the pool (call in afterAll). */
export async function teardown(): Promise<void> {
  await pool.end();
}

/** Extract the token portion from a mailer message body. */
export function extractToken(body: string): string {
  const match = /token:\s*([A-Za-z0-9_-]+)/.exec(body);
  if (match === null || match[1] === undefined) throw new Error(`no token in body: ${body}`);
  return match[1];
}
