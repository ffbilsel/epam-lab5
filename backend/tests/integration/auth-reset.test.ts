import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { extractToken, resetDb, setupTestEnv, teardown } from './_setup.js';

const { app, mailer } = setupTestEnv();

async function registerAndVerify(email: string, password: string): Promise<void> {
  await request(app).post('/auth/register').send({ email, password });
  const token = extractToken(mailer.sent[mailer.sent.length - 1]!.text);
  await request(app).post('/auth/verify').send({ token });
}

beforeEach(async () => {
  await resetDb();
  mailer.sent.length = 0;
});

afterAll(async () => {
  await teardown();
});

describe('POST /auth/reset/request', () => {
  it('returns 202 for a known email and dispatches a reset email', async () => {
    await registerAndVerify('alice@example.com', 'abcd1234');
    mailer.sent.length = 0;

    const res = await request(app).post('/auth/reset/request').send({ email: 'alice@example.com' });
    expect(res.status).toBe(202);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.subject).toMatch(/reset/i);
  });

  it('returns identical 202 body for unknown emails (FR-013, no enumeration)', async () => {
    const known = await request(app)
      .post('/auth/reset/request')
      .send({ email: 'alice@example.com' });
    const unknown = await request(app)
      .post('/auth/reset/request')
      .send({ email: 'nobody@example.com' });
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body).toEqual(unknown.body);
  });
});

describe('POST /auth/reset/confirm', () => {
  it('changes the password and revokes all live sessions (FR-015)', async () => {
    await registerAndVerify('bob@example.com', 'oldpass12');
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'bob@example.com', password: 'oldpass12' });
    const oldToken = login.body.token as string;

    mailer.sent.length = 0;
    await request(app).post('/auth/reset/request').send({ email: 'bob@example.com' });
    const resetToken = extractToken(mailer.sent[0]!.text);

    const confirm = await request(app)
      .post('/auth/reset/confirm')
      .send({ token: resetToken, newPassword: 'newpass34' });
    expect(confirm.status).toBe(204);

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${oldToken}`);
    expect(me.status).toBe(401);

    const re = await request(app)
      .post('/auth/login')
      .send({ email: 'bob@example.com', password: 'newpass34' });
    expect(re.status).toBe(200);
  });

  it('returns 410 for invalid reset tokens', async () => {
    const res = await request(app)
      .post('/auth/reset/confirm')
      .send({ token: 'never-issued-aaaaaaaaaaaaaaaaaaaaaaaa', newPassword: 'abcd1234' });
    expect(res.status).toBe(410);
  });
});
