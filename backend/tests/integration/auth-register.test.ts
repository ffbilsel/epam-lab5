import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { extractToken, resetDb, setupTestEnv, teardown } from './_setup.js';

const { app, mailer } = setupTestEnv();

beforeEach(async () => {
  await resetDb();
  mailer.sent.length = 0;
});

afterAll(async () => {
  await teardown();
});

describe('POST /auth/register', () => {
  it('returns 202 and dispatches a verification email for a new account', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'alice@example.com', password: 'abcd1234' });
    expect(res.status).toBe(202);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.to).toBe('alice@example.com');
    expect(mailer.sent[0]?.subject).toMatch(/verify/i);
  });

  it('returns 202 with identical body for a duplicate email (FR-005)', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'bob@example.com', password: 'abcd1234' });
    mailer.sent.length = 0;

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'bob@example.com', password: 'abcd1234' });
    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty('message');
    expect(mailer.sent).toHaveLength(0);
  });

  it('rejects weak passwords with 400 problem+json', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'weak@example.com', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
  });
});

describe('POST /auth/verify', () => {
  it('verifies an account using the token from the email', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'carol@example.com', password: 'abcd1234' });
    const token = extractToken(mailer.sent[0]!.text);
    const res = await request(app).post('/auth/verify').send({ token });
    expect(res.status).toBe(204);
  });

  it('returns 410 for an unknown token', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ token: 'this-token-does-not-exist-aaaaaaaaaaaaaaaaaaaa' });
    expect(res.status).toBe(410);
  });
});
