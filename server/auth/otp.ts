import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const OTP_MIN = 0;
const OTP_MAX = 1000000;

function otpHmac(userId: string, otpCode: string): string {
  return createHmac("sha256", env.AUTH_SESSION_SECRET)
    .update(`otp:${userId}:${otpCode}`)
    .digest("hex");
}

export function generateOtpCode(): string {
  return randomInt(OTP_MIN, OTP_MAX).toString().padStart(6, "0");
}

export function hashOtpCode(userId: string, otpCode: string): string {
  return otpHmac(userId, otpCode);
}

export function verifyOtpCodeHash(userId: string, otpCode: string, storedHash: string): boolean {
  if (!userId || !otpCode || !storedHash) {
    return false;
  }

  const expected = otpHmac(userId, otpCode);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const storedBuffer = Buffer.from(storedHash, "utf8");

  if (expectedBuffer.length !== storedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, storedBuffer);
}

export function getOtpExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + env.OTP_TTL_MINUTES * 60 * 1000);
}
