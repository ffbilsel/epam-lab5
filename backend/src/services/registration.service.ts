import { env } from '../config/env.js';
import { systemClock, type Clock } from '../infra/clock.js';
import { withTx } from '../infra/db.js';
import { hash } from '../infra/hasher.js';
import { getMailer, type Mailer } from '../infra/mailer.js';
import { generateToken, hashToken } from '../lib/crypto.js';
import { record as auditRecord } from '../repositories/audit.repo.js';
import * as userRepo from '../repositories/user.repo.js';
import * as verifyRepo from '../repositories/verification.repo.js';
import { validatePassword } from '../domain/password-policy.js';
import { ValidationError } from '../domain/errors.js';

/** Request body for {@link RegistrationService.register}. */
export interface RegisterInput {
  /** Email address (already lowercase). */
  email: string;
  /** Plain-text candidate password. */
  password: string;
  /** Source IP for audit. */
  ip?: string;
  /** User-Agent for audit. */
  userAgent?: string;
}

/** Public registration API. */
export interface RegistrationService {
  /**
   * Register a new account. Always returns success-shaped ack to avoid
   * email enumeration (FR-005).
   */
  register(input: RegisterInput): Promise<void>;
}

/** Dependencies (test seam). */
export interface RegistrationDeps {
  /** Clock. */
  clock?: Clock;
  /** Mailer. */
  mailer?: Mailer;
}

/**
 * Build the registration service.
 * @param deps Optional injected dependencies.
 */
export function buildRegistrationService(deps: RegistrationDeps = {}): RegistrationService {
  const clock = deps.clock ?? systemClock;
  const resolveMailer = (): Mailer => deps.mailer ?? getMailer();

  return {
    register: async (input): Promise<void> => {
      const policy = validatePassword(input.password);
      if (!policy.ok) {
        throw new ValidationError(`Password ${policy.reason ?? 'is invalid'}`);
      }

      const email = input.email.trim().toLowerCase();
      const now = clock.now();

      let issuedToken: string | null = null;
      let recipient: string | null = null;

      await withTx(async (client) => {
        const existing = await userRepo.findByEmail(email, client);
        if (existing !== null) {
          await auditRecord(
            {
              userId: existing.id,
              eventType: 'registration',
              outcome: 'failure',
              ip: input.ip ?? null,
              userAgent: input.userAgent ?? null,
              metadata: { reason: 'duplicate_email' },
            },
            client,
          );
          return;
        }

        const passwordHash = await hash(input.password);
        const user = await userRepo.insertUnverified(email, passwordHash, client);

        const raw = generateToken();
        const expiresAt = new Date(now.getTime() + env.VERIFY_TOKEN_TTL_SECONDS * 1000);
        await verifyRepo.insert(user.id, hashToken(raw), expiresAt, client);

        await auditRecord(
          {
            userId: user.id,
            eventType: 'registration',
            outcome: 'success',
            ip: input.ip ?? null,
            userAgent: input.userAgent ?? null,
          },
          client,
        );

        issuedToken = raw;
        recipient = user.email;
      });

      if (issuedToken !== null && recipient !== null) {
        await resolveMailer().send({
          to: recipient,
          subject: 'Verify your email',
          text: `Your verification token: ${issuedToken}\nIt expires in ${env.VERIFY_TOKEN_TTL_SECONDS} seconds.`,
        });
      }
    },
  };
}
