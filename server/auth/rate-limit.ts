import { env } from "@/lib/env";
import { db } from "@/server/db";

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function windowStart(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

export async function checkOtpSendRateLimit(userId: string): Promise<RateLimitResult> {
  const start = windowStart(env.OTP_SEND_WINDOW_MINUTES);
  const currentCount = await db.oTPCode.count({
    where: {
      userId,
      createdAt: { gte: start },
    },
  });

  if (currentCount < env.OTP_MAX_SENDS_PER_WINDOW) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const earliest = await db.oTPCode.findFirst({
    where: {
      userId,
      createdAt: { gte: start },
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  if (!earliest) {
    return { allowed: false, retryAfterSeconds: env.OTP_SEND_WINDOW_MINUTES * 60 };
  }

  const retryAtMs = earliest.createdAt.getTime() + env.OTP_SEND_WINDOW_MINUTES * 60 * 1000;
  const retryAfterSeconds = Math.max(1, Math.ceil((retryAtMs - Date.now()) / 1000));

  return { allowed: false, retryAfterSeconds };
}

export async function checkOtpVerifyRateLimit(userId: string): Promise<RateLimitResult> {
  const start = windowStart(env.OTP_VERIFY_WINDOW_MINUTES);
  const aggregate = await db.oTPCode.aggregate({
    where: {
      userId,
      createdAt: { gte: start },
    },
    _sum: {
      attempts: true,
    },
  });

  const attempts = aggregate._sum.attempts ?? 0;
  if (attempts < env.OTP_MAX_VERIFY_ATTEMPTS_PER_WINDOW) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const earliestAttempted = await db.oTPCode.findFirst({
    where: {
      userId,
      createdAt: { gte: start },
      attempts: { gt: 0 },
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  if (!earliestAttempted) {
    return { allowed: false, retryAfterSeconds: env.OTP_VERIFY_WINDOW_MINUTES * 60 };
  }

  const retryAtMs =
    earliestAttempted.createdAt.getTime() + env.OTP_VERIFY_WINDOW_MINUTES * 60 * 1000;
  const retryAfterSeconds = Math.max(1, Math.ceil((retryAtMs - Date.now()) / 1000));

  return { allowed: false, retryAfterSeconds };
}
