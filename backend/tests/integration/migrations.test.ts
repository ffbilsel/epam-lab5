import { afterAll, describe, expect, it } from '@jest/globals';
import { pool } from '../../src/infra/db.js';

afterAll(async () => {
  await pool.end();
});

describe('migrations', () => {
  it('has applied the five core tables', async () => {
    const res = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE'
        ORDER BY table_name`,
    );
    const names = res.rows.map((r) => r.table_name);
    expect(names).toEqual(
      expect.arrayContaining([
        'audit_events',
        'email_verifications',
        'password_resets',
        'sessions',
        'users',
      ]),
    );
  });
});
