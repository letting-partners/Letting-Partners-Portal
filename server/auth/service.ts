import "server-only";
import type { UserRole } from "@prisma/client";
import { env } from "@/lib/env";
import { db } from "@/server/db";
import { sendOtpLoginEmail } from "@/server/email";
import { isOtpRequiredForLogin } from "./activity";
import { generateOtpCode, getOtpExpiresAt, hashOtpCode, verifyOtpCodeHash } from "./otp";
import { verifyPassword } from "./password";
import { checkOtpSendRateLimit, checkOtpVerifyRateLimit } from "./rate-limit";

type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

type LoginResult =
  | { ok: true; requiresOtp: true }
  | { ok: true; requiresOtp: false; user: AuthUser }
  | {
      ok: false;
      code:
        | "INVALID_CREDENTIALS"
        | "OTP_SEND_RATE_LIMIT"
        | "OTP_DELIVERY_FAILED"
        | "ROLE_MISMATCH";
      retryAfterSeconds?: number;
      actualRole?: UserRole;
    };

type VerifyOtpResult =
  | { ok: true; user: AuthUser }
  | {
      ok: false;
      code:
        | "INVALID_CREDENTIALS"
        | "OTP_VERIFY_RATE_LIMIT"
        | "OTP_REQUIRED"
        | "OTP_EXPIRED"
        | "OTP_INVALID"
        | "OTP_ATTEMPTS_EXCEEDED"
        | "ROLE_MISMATCH";
      retryAfterSeconds?: number;
      attemptsRemaining?: number;
      actualRole?: UserRole;
    };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function loginWithPassword(params: {
  email: string;
  password: string;
  expectedRole?: UserRole;
}): Promise<LoginResult> {
  const email = normalizeEmail(params.email);
  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      passwordHash: true,
      isActive: true,
      lastActivityAt: true,
    },
  });

  if (!user || !user.isActive) {
    return { ok: false, code: "INVALID_CREDENTIALS" };
  }

  const passwordIsValid = await verifyPassword(params.password, user.passwordHash);
  if (!passwordIsValid) {
    return { ok: false, code: "INVALID_CREDENTIALS" };
  }

  if (params.expectedRole && user.role !== params.expectedRole) {
    return {
      ok: false,
      code: "ROLE_MISMATCH",
      actualRole: user.role,
    };
  }

  const now = new Date();
  if (!isOtpRequiredForLogin(user.lastActivityAt, now)) {
    await db.user.update({
      where: { id: user.id },
      data: { lastActivityAt: now },
    });

    return {
      ok: true,
      requiresOtp: false,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  const sendRateLimit = await checkOtpSendRateLimit(user.id);
  if (!sendRateLimit.allowed) {
    return {
      ok: false,
      code: "OTP_SEND_RATE_LIMIT",
      retryAfterSeconds: sendRateLimit.retryAfterSeconds,
    };
  }

  const otpCode = generateOtpCode();
  const codeHash = hashOtpCode(user.id, otpCode);
  const expiresAt = getOtpExpiresAt();

  await db.$transaction([
    db.oTPCode.updateMany({
      where: {
        userId: user.id,
        expiresAt: { gt: now },
      },
      data: {
        expiresAt: now,
      },
    }),
    db.oTPCode.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt,
        attempts: 0,
      },
    }),
  ]);

  try {
    await sendOtpLoginEmail({
      to: user.email,
      otpCode,
      expiresInMinutes: env.OTP_TTL_MINUTES,
    });
  } catch {
    await db.oTPCode.deleteMany({
      where: {
        userId: user.id,
        codeHash,
      },
    });
    return { ok: false, code: "OTP_DELIVERY_FAILED" };
  }

  return { ok: true, requiresOtp: true };
}

export async function verifyOtpForLogin(params: {
  email: string;
  otpCode: string;
  expectedRole?: UserRole;
}): Promise<VerifyOtpResult> {
  const email = normalizeEmail(params.email);
  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    return { ok: false, code: "INVALID_CREDENTIALS" };
  }

  if (params.expectedRole && user.role !== params.expectedRole) {
    return {
      ok: false,
      code: "ROLE_MISMATCH",
      actualRole: user.role,
    };
  }

  const verifyRateLimit = await checkOtpVerifyRateLimit(user.id);
  if (!verifyRateLimit.allowed) {
    return {
      ok: false,
      code: "OTP_VERIFY_RATE_LIMIT",
      retryAfterSeconds: verifyRateLimit.retryAfterSeconds,
    };
  }

  const otpRecord = await db.oTPCode.findFirst({
    where: {
      userId: user.id,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) {
    const latestOtpRecord = await db.oTPCode.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { expiresAt: true },
    });

    if (latestOtpRecord && latestOtpRecord.expiresAt <= new Date()) {
      return { ok: false, code: "OTP_EXPIRED" };
    }

    return { ok: false, code: "OTP_REQUIRED" };
  }

  if (otpRecord.attempts >= env.OTP_MAX_VERIFY_ATTEMPTS_PER_CODE) {
    return { ok: false, code: "OTP_ATTEMPTS_EXCEEDED", attemptsRemaining: 0 };
  }

  const otpIsValid = verifyOtpCodeHash(user.id, params.otpCode, otpRecord.codeHash);
  if (!otpIsValid) {
    const updated = await db.oTPCode.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });

    const attemptsRemaining = Math.max(
      env.OTP_MAX_VERIFY_ATTEMPTS_PER_CODE - updated.attempts,
      0,
    );

    return { ok: false, code: "OTP_INVALID", attemptsRemaining };
  }

  const now = new Date();

  await db.$transaction([
    db.oTPCode.update({
      where: { id: otpRecord.id },
      data: {
        expiresAt: now,
      },
    }),
    db.user.update({
      where: { id: user.id },
      data: {
        lastActivityAt: now,
      },
    }),
  ]);

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  };
}
