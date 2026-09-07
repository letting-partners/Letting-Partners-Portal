import "server-only";
import { and, desc, eq, gt, isNull, sql as raw } from "drizzle-orm";
import { db } from "@/db";
import { otpCodes, users } from "@/db/schema";
import { sendEmail } from "@/lib/email/client";
import { otpEmail } from "@/lib/email/templates";
import { serverEnv } from "@/lib/env";
import { generateOtpCode, hashOtp, normalizeEmail, safeEqual } from "./crypto";
import { consumeRateLimit, RATE_LIMITS, resetRateLimit } from "./rate-limit";

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

export type RequestOtpResult =
  | { ok: true }
  | { ok: false; error: string; retryAfterSeconds?: number };

export type VerifyOtpResult =
  | { ok: true; userId: string }
  | { ok: false; error: string; retryAfterSeconds?: number };

/**
 * Send a login code.
 *
 * Deliberately returns success for unknown addresses: telling a stranger
 * whether an email has a portal account would leak the staff list. The rate
 * limiters run before the account lookup so enumeration is throttled too.
 */
export async function requestOtp(
  emailInput: string,
  ip: string | null,
): Promise<RequestOtpResult> {
  const email = normalizeEmail(emailInput);
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const perEmail = await consumeRateLimit(`otp:req:email:${email}`, RATE_LIMITS.otpRequestPerEmail);
  if (!perEmail.allowed) {
    return {
      ok: false,
      error: "Too many codes requested. Please wait before trying again.",
      retryAfterSeconds: perEmail.retryAfterSeconds,
    };
  }

  if (ip) {
    const perIp = await consumeRateLimit(`otp:req:ip:${ip}`, RATE_LIMITS.otpRequestPerIp);
    if (!perIp.allowed) {
      return {
        ok: false,
        error: "Too many codes requested. Please wait before trying again.",
        retryAfterSeconds: perIp.retryAfterSeconds,
      };
    }
  }

  const account = await db
    .select({ id: users.id, status: users.status })
    .from(users)
    .where(and(raw`lower(${users.email}) = ${email}`, isNull(users.deletedAt)))
    .limit(1);

  const user = account[0];

  // Unknown or deactivated account: stop here, but report success.
  if (!user || user.status !== "ACTIVE") return { ok: true };

  const env = serverEnv();
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  // Invalidate any earlier live codes so only the newest one works.
  await db
    .update(otpCodes)
    .set({ consumedAt: new Date() })
    .where(and(raw`lower(${otpCodes.email}) = ${email}`, isNull(otpCodes.consumedAt)));

  await db.insert(otpCodes).values({
    email,
    codeHash: hashOtp(code, email, env.AUTH_SECRET),
    expiresAt,
    requestIp: ip,
  });

  const message = otpEmail(code, OTP_TTL_MINUTES);
  const sent = await sendEmail({
    to: email,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  if (!sent.ok) {
    return { ok: false, error: "We could not send the code. Please try again shortly." };
  }

  return { ok: true };
}

/**
 * Check a code. Attempts are counted on the stored row so a code cannot be
 * brute forced even within its ten minute life, and a used code is burned
 * immediately so it can never be replayed.
 */
export async function verifyOtp(
  emailInput: string,
  codeInput: string,
): Promise<VerifyOtpResult> {
  const email = normalizeEmail(emailInput);
  const code = codeInput.replace(/\D/g, "");

  if (code.length !== 6) return { ok: false, error: "Enter the 6 digit code." };

  const limiter = await consumeRateLimit(
    `otp:verify:email:${email}`,
    RATE_LIMITS.otpVerifyPerEmail,
  );
  if (!limiter.allowed) {
    return {
      ok: false,
      error: "Too many incorrect attempts. Please request a new code shortly.",
      retryAfterSeconds: limiter.retryAfterSeconds,
    };
  }

  const rows = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        raw`lower(${otpCodes.email}) = ${email}`,
        isNull(otpCodes.consumedAt),
        gt(otpCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  const record = rows[0];
  if (!record) {
    return { ok: false, error: "That code has expired. Request a new one." };
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, record.id));
    return { ok: false, error: "Too many incorrect attempts. Request a new code." };
  }

  const env = serverEnv();
  const expected = hashOtp(code, email, env.AUTH_SECRET);

  if (!safeEqual(expected, record.codeHash)) {
    await db
      .update(otpCodes)
      .set({ attempts: record.attempts + 1 })
      .where(eq(otpCodes.id, record.id));
    const left = OTP_MAX_ATTEMPTS - (record.attempts + 1);
    return {
      ok: false,
      error:
        left > 0
          ? `That code is not correct. ${left} attempt${left === 1 ? "" : "s"} remaining.`
          : "That code is not correct. Request a new one.",
    };
  }

  // Burn the code before issuing anything, so a replay cannot win a race.
  const burned = await db
    .update(otpCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpCodes.id, record.id), isNull(otpCodes.consumedAt)))
    .returning({ id: otpCodes.id });

  if (burned.length === 0) {
    return { ok: false, error: "That code has already been used. Request a new one." };
  }

  const account = await db
    .select({ id: users.id, status: users.status })
    .from(users)
    .where(and(raw`lower(${users.email}) = ${email}`, isNull(users.deletedAt)))
    .limit(1);

  const user = account[0];
  if (!user || user.status !== "ACTIVE") {
    return { ok: false, error: "This account is not active. Contact an administrator." };
  }

  await resetRateLimit(`otp:verify:email:${email}`);
  await resetRateLimit(`otp:req:email:${email}`);

  return { ok: true, userId: user.id };
}
