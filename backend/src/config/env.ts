import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_SECRET_PREV: z.string().optional().default(''),
  JWT_EXPIRES_IN: z.coerce.number().int().positive().default(86_400),
  BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(12),
  SMTP_URL: z.string().url(),
  EMAIL_FROM: z.string().email(),
  RESET_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(3_600),
  VERIFY_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  LOCKOUT_THRESHOLD: z.coerce.number().int().positive().default(10),
  LOCKOUT_WINDOW_SECONDS: z.coerce.number().int().positive().default(600),
  LOCKOUT_DURATION_SECONDS: z.coerce.number().int().positive().default(900),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_AUTH_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

/** Validated, immutable runtime configuration. */
export type Env = Readonly<z.infer<typeof EnvSchema>>;

/**
 * Loads and validates process.env. Aborts the process on failure so misconfig
 * is detected at startup, not at request time.
 */
function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Use stderr directly; logger may not be initialised yet.
    process.stderr.write(
      `[config] invalid environment:\n${JSON.stringify(parsed.error.flatten(), null, 2)}\n`,
    );
    process.exit(1);
  }
  return Object.freeze(parsed.data);
}

/** Singleton validated env, populated at module load. */
export const env: Env = loadEnv();
