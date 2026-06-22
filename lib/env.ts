import { z } from "zod";

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.string().url("APP_URL must be a valid URL").default("http://localhost:3002"),
  AUTH_SESSION_SECRET: z.string().min(32, "AUTH_SESSION_SECRET must be at least 32 chars"),
  AUTH_COOKIE_NAME: z.string().min(1).default("letting_partners_session"),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().positive().max(168).default(12),
  OTP_EMAIL_FROM: z.string().email("OTP_EMAIL_FROM must be a valid email"),
  OTP_TTL_MINUTES: z.coerce.number().int().positive().max(60).default(10),
  OTP_MAX_SENDS_PER_WINDOW: z.coerce.number().int().positive().max(20).default(5),
  OTP_SEND_WINDOW_MINUTES: z.coerce.number().int().positive().max(60).default(10),
  OTP_MAX_VERIFY_ATTEMPTS_PER_CODE: z.coerce.number().int().positive().max(10).default(5),
  OTP_MAX_VERIFY_ATTEMPTS_PER_WINDOW: z.coerce.number().int().positive().max(30).default(10),
  OTP_VERIFY_WINDOW_MINUTES: z.coerce.number().int().positive().max(60).default(10),
  ALLOW_ADMIN_PASSIVE_REVERT: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

const consoleEmailSchema = baseEnvSchema.extend({
  EMAIL_PROVIDER: z.literal("console").default("console"),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
});

const resendEmailSchema = baseEnvSchema.extend({
  EMAIL_PROVIDER: z.literal("resend"),
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required when EMAIL_PROVIDER=resend"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
});

const smtpEmailSchema = baseEnvSchema.extend({
  EMAIL_PROVIDER: z.literal("smtp"),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().min(1, "SMTP_HOST is required when EMAIL_PROVIDER=smtp"),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().min(1, "SMTP_USER is required when EMAIL_PROVIDER=smtp"),
  SMTP_PASSWORD: z.string().min(1, "SMTP_PASSWORD is required when EMAIL_PROVIDER=smtp"),
});

const envSchema = z.discriminatedUnion("EMAIL_PROVIDER", [
  consoleEmailSchema,
  resendEmailSchema,
  smtpEmailSchema,
]);

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  APP_URL: process.env.APP_URL,
  AUTH_SESSION_SECRET:
    process.env.AUTH_SESSION_SECRET ??
    process.env.SESSION_SECRET ??
    process.env.JWT_SECRET,
  AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME,
  AUTH_SESSION_TTL_HOURS: process.env.AUTH_SESSION_TTL_HOURS,
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER ?? "console",
  OTP_EMAIL_FROM: process.env.OTP_EMAIL_FROM,
  OTP_TTL_MINUTES: process.env.OTP_TTL_MINUTES,
  OTP_MAX_SENDS_PER_WINDOW: process.env.OTP_MAX_SENDS_PER_WINDOW,
  OTP_SEND_WINDOW_MINUTES: process.env.OTP_SEND_WINDOW_MINUTES,
  OTP_MAX_VERIFY_ATTEMPTS_PER_CODE: process.env.OTP_MAX_VERIFY_ATTEMPTS_PER_CODE,
  OTP_MAX_VERIFY_ATTEMPTS_PER_WINDOW: process.env.OTP_MAX_VERIFY_ATTEMPTS_PER_WINDOW,
  OTP_VERIFY_WINDOW_MINUTES: process.env.OTP_VERIFY_WINDOW_MINUTES,
  ALLOW_ADMIN_PASSIVE_REVERT: process.env.ALLOW_ADMIN_PASSIVE_REVERT,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
});
