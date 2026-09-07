import { z } from "zod";

/**
 * Environment access is validated once, here. Nothing else in the portal reads
 * `process.env` directly, so a missing variable fails loudly at boot rather
 * than as a confusing runtime error later.
 *
 * Client-safe values must be prefixed NEXT_PUBLIC_ and listed in `publicEnv`.
 */

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  /** 32+ random bytes, used to sign session tokens and hash OTP codes. */
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  SESSION_REMEMBER_TTL_DAYS: z.coerce.number().int().positive().default(30),

  RESEND_API_KEY: z.string().optional(),
  AUTH_FROM_EMAIL: z.string().default("Letting Partners <no-reply@lettingpartners.co.uk>"),

  /** Shared secret the public website sends as x-website-api-key. */
  WEBSITE_API_KEY: z.string().min(16, "WEBSITE_API_KEY must be at least 16 characters"),

  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  /** Optional vision provider for automatic image alt text. */
  ALT_TEXT_PROVIDER: z.enum(["none", "anthropic"]).default("none"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ALT_TEXT_MODEL: z.string().default("claude-sonnet-5"),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("https://www.lettingpartners.co.uk"),
  NEXT_PUBLIC_PORTAL_URL: z.string().url().default("https://portal.lettingpartners.co.uk"),
  NEXT_PUBLIC_COMPANY_NAME: z.string().default("Letting Partners"),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type PublicEnv = z.infer<typeof publicSchema>;

let cachedServerEnv: ServerEnv | null = null;

/** Server-only. Throws with a readable list of every missing variable. */
export function serverEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid portal environment configuration:\n${issues}\n\nSee .env.example for the full list.`,
    );
  }

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

/**
 * Read literally so the Next.js compiler can inline these into the client
 * bundle. Do not refactor into a dynamic lookup.
 */
export const publicEnv: PublicEnv = publicSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_PORTAL_URL: process.env.NEXT_PUBLIC_PORTAL_URL,
  NEXT_PUBLIC_COMPANY_NAME: process.env.NEXT_PUBLIC_COMPANY_NAME,
});

export const isProduction = process.env.NODE_ENV === "production";
export const isDevelopment = process.env.NODE_ENV === "development";
