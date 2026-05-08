import { env } from '../config/env.js';
import { systemClock, type Clock } from '../infra/clock.js';
import { withTx } from '../infra/db.js';
import { getMailer, type Mailer } from '../infra/mailer.js';
import { generateToken, hashToken } from '../lib/crypto.js';
import { record as auditRecord } from '../repositories/audit.repo.js';
import * as userRepo from '../repositories/user.repo.js';
import * as verifyRepo from '../repositories/verification.repo.js';
import { GoneError } from '../domain/errors.js';

/** Verification API. */
export interface VerificationService {
  /**
   * Consume a raw verification token.
   * @throws {GoneError} when the token is expired, unknown, or already used.
   */
  verify(rawToken: string): Promise<void>;
  /**
   * Resend a verification email. Always succeeds from the caller's perspective
   * (FR-005c). Invalidates any previously unused token.
   */
  resend(email: string): Promise<void>;
}

/** Dependencies. */
export interface VerificationDeps {
  /** Clock. */
  clock?: Clock;
  /** Mailer. */
  mailer?: Mailer;
}

/**
 * Build the verification service.
 * @param deps Optional injected dependencies.
 */
export function buildVerificationService(deps: VerificationDeps = {}): VerificationService {
  const clock = deps.clock ?? systemClock;
  const resolveMailer = (): Mailer => deps.mailer ?? getMailer();

  return {
    verify: async (rawToken): Promise<void> => {
      const now = clock.now();
      const tokenHash = hashToken(rawToken);

      await withTx(async (client) => {
        const row = await verifyRepo.findValidByTokenHash(tokenHash, now, client);
        if (row === null) throw new GoneError('Verification token is invalid or expired');
        await verifyRepo.markConsumed(row.id, now, client);
        await userRepo.markEmailVerified(row.user_id, now, client);
        await verifyRepo.invalidateAllForUser(row.user_id, now, client);
        await auditRecord(
          { userId: row.user_id, eventType: 'email_verification_completed', outcome: 'success' },
          client,
        );
      });
    },

    resend: async (email): Promise<void> => {
      const normalised = email.trim().toLowerCase();
      const now = clock.now();
      let issued: string | null = null;
      let to: string | null = null;

      await withTx(async (client) => {
        const user = await userRepo.findByEmail(normalised, client);
        if (user === null || user.email_verified_at !== null) return;
        await verifyRepo.invalidateAllForUser(user.id, now, client);
        const raw = generateToken();
        const expiresAt = new Date(now.getTime() + env.VERIFY_TOKEN_TTL_SECONDS * 1000);
        await verifyRepo.insert(user.id, hashToken(raw), expiresAt, client);
        await auditRecord(
          { userId: user.id, eventType: 'email_verification_resent', outcome: 'success' },
          client,
        );
        issued = raw;
        to = user.email;
      });

      if (issued !== null && to !== null) {
        await resolveMailer().send({
          to,
          subject: 'Verify your email',
          text: `Your new verification token: ${issued}`,
        });
      }
    },
  };
}
