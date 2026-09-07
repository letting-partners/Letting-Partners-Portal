import "server-only";
import { sql as raw } from "drizzle-orm";
import { db, executeRows } from "@/db";
import { rateLimits } from "@/db/schema";

/**
 * Fixed-window rate limiting backed by Postgres rather than memory, because
 * serverless instances do not share state - an in-memory counter would reset
 * on every cold start and provide no real protection.
 */

export type RateLimitRule = {
  /** Requests permitted inside the window. */
  limit: number;
  windowSeconds: number;
  /** How long to lock the key out once the limit is exceeded. */
  blockSeconds?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export const RATE_LIMITS = {
  /** OTP requests per email address. */
  otpRequestPerEmail: { limit: 5, windowSeconds: 15 * 60, blockSeconds: 15 * 60 },
  /** OTP requests per client IP, so one actor cannot enumerate addresses. */
  otpRequestPerIp: { limit: 15, windowSeconds: 15 * 60, blockSeconds: 15 * 60 },
  /** Verification attempts per email address. */
  otpVerifyPerEmail: { limit: 10, windowSeconds: 15 * 60, blockSeconds: 30 * 60 },
  /** Visitor messages on the public chat widget. */
  customerChatPerVisitor: { limit: 30, windowSeconds: 5 * 60 },
} satisfies Record<string, RateLimitRule>;

/**
 * Atomically increments the counter for `key`. The whole decision is made in a
 * single statement so two concurrent requests cannot both see a stale count.
 */
export async function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  // Every timestamp comes from the database clock rather than this process.
  // Serverless instances do not share a clock, so comparing an app-side
  // `new Date()` against a stored timestamp would drift between them.
  const rows = await executeRows<{
    count: number | string;
    blocked_seconds_left: number | string | null;
  }>(
    db,
    raw`
      insert into ${rateLimits} (key, count, window_started_at)
      values (${key}, 1, now())
      on conflict (key) do update set
        count = case
          when rate_limits.blocked_until is not null and rate_limits.blocked_until > now()
            then rate_limits.count
          when rate_limits.window_started_at < now() - make_interval(secs => ${rule.windowSeconds})
            then 1
          else rate_limits.count + 1
        end,
        window_started_at = case
          when rate_limits.blocked_until is not null and rate_limits.blocked_until > now()
            then rate_limits.window_started_at
          when rate_limits.window_started_at < now() - make_interval(secs => ${rule.windowSeconds})
            then now()
          else rate_limits.window_started_at
        end,
        blocked_until = case
          when rate_limits.blocked_until is not null and rate_limits.blocked_until > now()
            then rate_limits.blocked_until
          else null
        end
      returning
        count,
        case
          when blocked_until is null then null
          else ceil(extract(epoch from (blocked_until - now())))
        end as blocked_seconds_left
    `,
  );

  const row = rows[0];
  if (!row) return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };

  // Still inside an active block from a previous breach.
  const blockedSecondsLeft = row.blocked_seconds_left === null ? 0 : Number(row.blocked_seconds_left);
  if (blockedSecondsLeft > 0) {
    return { allowed: false, remaining: 0, retryAfterSeconds: blockedSecondsLeft };
  }

  const count = Number(row.count);
  if (count > rule.limit) {
    const blockSeconds = rule.blockSeconds ?? rule.windowSeconds;
    await db.execute(raw`
      update ${rateLimits}
      set blocked_until = now() + make_interval(secs => ${blockSeconds})
      where key = ${key}
    `);
    return { allowed: false, remaining: 0, retryAfterSeconds: blockSeconds };
  }

  return { allowed: true, remaining: Math.max(0, rule.limit - count), retryAfterSeconds: 0 };
}

/** Clears a counter after a successful action, e.g. a correct OTP. */
export async function resetRateLimit(key: string): Promise<void> {
  await db.execute(raw`delete from ${rateLimits} where key = ${key}`);
}
