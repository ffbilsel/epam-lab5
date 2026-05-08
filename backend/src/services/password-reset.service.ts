import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';
import { systemClock, type Clock } from '../infra/clock.js';
import { withTx } from '../infra/db.js';
import { dummyVerify, hash } from '../infra/hasher.js';
import { getMailer, type Mailer } from '../infra/mailer.js';
import { generateToken, hashToken } from '../lib/crypto.js';
import { GoneError, ValidationError } from '../domain/errors.js';
import { validatePassword } from '../domain/password-policy.js';
import { record as auditRecord } from '../repositories/audit.repo.js';
import * as resetRepo from '../repositories/reset.repo.js';
import * as userRepo from '../repositories/user.repo.js';
import { buildSessionService, type SessionService } from './session.service.js';
import { buildNotificationService, type NotificationService } from './notification.service.js';

/** Public reset API. */
export interface PasswordResetService {
  /**
   * Request a reset email. Always returns success; non-enumerating (FR-013).
   * @param email Email address.
   */
  requestReset(email: string): Promise<void>;
  /**
   * Confirm a reset, set new password, revoke all sessions.
   * @param rawToken Raw reset token from the email.
   * @param newPassword New password (subject to policy).
   */
  confirmReset(rawToken: string, newPassword: string): Promise<void>;
}

/** Dependencies. */
export interface ResetDeps {
  /** Clock. */
  clock?: Clock;
  /** Mailer. */
  mailer?: Mailer;
  /** Session service (for revoke-all). */
  sessions?: SessionService;
  /** Notification service. */
  notifications?: NotificationService;
}

/**
 * Build the password-reset service.
 * @param deps Optional dependencies.
 */
export function buildPasswordResetService(deps: ResetDeps = {}): PasswordResetService {
  const clock = deps.clock ?? systemClock;
  const resolveMailer = (): Mailer => deps.mailer ?? getMailer();
  const sessions = deps.sessions ?? buildSessionService({ clock });
  const resolveNotifications = (): NotificationService =>
    deps.notifications ?? buildNotificationService(resolveMailer());

  return {
    requestReset: async (email): Promise<void> => {
      const normalised = email.trim().toLowerCase();
      const now = clock.now();
      let issued: string | null = null;
      let to: string | null = null;

      await withTx(async (client) => {
        const user = await userRepo.findByEmail(normalised, client);
        if (user === null) {
          await dummyVerify();
          await auditRecord(
            {
              eventType: 'reset_request',
              outcome: 'failure',
              metadata: { reason: 'unknown_email' },
            },
            client,
          );
          return;
        }
        const raw = generateToken();
        const expiresAt = new Date(now.getTime() + env.RESET_TOKEN_TTL_SECONDS * 1000);
        await resetRepo.insert(user.id, hashToken(raw), expiresAt, client);
        await auditRecord(
          { userId: user.id, eventType: 'reset_request', outcome: 'success' },
          client,
        );
        issued = raw;
        to = user.email;
      });

      if (issued !== null && to !== null) {
        await resolveMailer().send({
          to,
          subject: 'Reset your password',
          text: `Reset token: ${issued}\nExpires in ${env.RESET_TOKEN_TTL_SECONDS} seconds.`,
        });
      }
    },

    confirmReset: async (rawToken, newPassword): Promise<void> => {
      const policy = validatePassword(newPassword);
      if (!policy.ok) throw new ValidationError(`Password ${policy.reason ?? 'is invalid'}`);

      const tokenHash = hashToken(rawToken);
      const now = clock.now();

      const userId = await withTx(async (client): Promise<string> => {
        const row = await resetRepo.findValidByTokenHash(tokenHash, now, client);
        if (row === null) throw new GoneError('Reset token is invalid or expired');
        await resetRepo.markConsumed(row.id, now, client);
        const newHash = await hash(newPassword);
        await userRepo.updatePasswordHash(row.user_id, newHash, client);
        await userRepo.clearLockout(row.user_id, client);
        await auditRecord(
          { userId: row.user_id, eventType: 'reset_completed', outcome: 'success' },
          client,
        );
        await auditRecord(
          { userId: row.user_id, eventType: 'password_changed', outcome: 'success' },
          client,
        );
        return row.user_id;
      });

      await sessions.revokeAllForUser(userId);

      const user = await userRepo.findById(userId);
      if (user !== null) {
        const eventId = uuidv4();
        const notifications = resolveNotifications();
        await notifications.notifyPasswordChanged({ id: user.id, email: user.email }, eventId);
        await notifications.notifyResetCompleted({ id: user.id, email: user.email }, eventId);
      }
    },
  };
}
