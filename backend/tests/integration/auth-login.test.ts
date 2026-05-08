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

describe('POST /auth/login', () => {
  it('returns 200 + JWT for verified user with correct credentials', async () => {
    await registerAndVerify('alice@example.com', 'abcd1234');
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'abcd1234' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('expiresAt');
  });

  it('returns 401 for wrong password (FR-009)', async () => {
    await registerAndVerify('bob@example.com', 'abcd1234');
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'bob@example.com', password: 'wrongpass1' });
    expect(res.status).toBe(401);
  });

  it('returns 401 with email_not_verified code for unverified accounts', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'carol@example.com', password: 'abcd1234' });
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'carol@example.com', password: 'abcd1234' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('email_not_verified');
  });

  it('returns 423 after the lockout threshold (FR-010)', async () => {
    await registerAndVerify('dave@example.com', 'abcd1234');
    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      const r = await request(app)
        .post('/auth/login')
        .send({ email: 'dave@example.com', password: 'wrongpass1' });
      lastStatus = r.status;
      if (r.status === 423) break;
    }
    expect(lastStatus).toBe(423);
  }, 60_000);
});

describe('POST /auth/logout + GET /me', () => {
  it('logout invalidates the JWT immediately (FR-008)', async () => {
    await registerAndVerify('eve@example.com', 'abcd1234');
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'eve@example.com', password: 'abcd1234' });
    const token = login.body.token as string;

    const me1 = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me1.status).toBe(200);

    const out = await request(app).post('/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(out.status).toBe(204);

    const me2 = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me2.status).toBe(401);
  });

  it('GET /me returns 401 without a bearer token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });
});
